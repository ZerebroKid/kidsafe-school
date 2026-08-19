# Zumi GPU VM runbook (Phase 4)

One GPU VM hosts the two self-hosted inference services the streaming
pipeline will use: **Kokoro TTS (GPU)** and **faster-whisper STT**
(`speaches`). Nothing depends on this box until Phase 5/6 flip the
`sttProvider` / `ttsProvider` flags in `appConfig/zumi` -- so the rollback
for everything here is "stop the VM".

- GCP project: `zumi-gpu` (separate from the Firebase project on purpose --
  own billing line, deletable in one shot)
- VM: `zumi-gpu-1`, zone `asia-south1-a`, `n1-standard-4` + 1× NVIDIA T4,
  **spot** (`--instance-termination-action=STOP`: preemption stops, never
  deletes), 100 GB pd-balanced boot disk
- Cost: ~₹12–15/hr while RUNNING, ~₹900–1,000/month for the disk while
  STOPPED, ₹0 deleted. Budget alert `zumi-gpu-cap` (₹5,000, 50/90/100%)
  is set on the project.

**Golden rule: `stop` the VM when you finish a work session.** Delete it
entirely (this runbook recreates it in ~20 min) if there will be a gap of
more than ~2 weeks before the next GPU phase.

## Recreate the VM from scratch

```bash
gcloud config set project zumi-gpu

# Image families rotate; list current ones and pick the newest ubuntu CUDA
# family (the nvidia-### suffix means the driver is preinstalled):
gcloud compute images list --project=deeplearning-platform-release \
  --filter="family~common-cu" --format="value(family)" | sort -u

gcloud compute instances create zumi-gpu-1 \
  --zone=asia-south1-a \
  --machine-type=n1-standard-4 \
  --accelerator=type=nvidia-tesla-t4,count=1 \
  --provisioning-model=SPOT \
  --instance-termination-action=STOP \
  --image-family=common-cu129-ubuntu-2204-nvidia-580 \
  --image-project=deeplearning-platform-release \
  --boot-disk-size=100GB \
  --boot-disk-type=pd-balanced \
  --maintenance-policy=TERMINATE
```

If creation fails with `ZONE_RESOURCE_POOL_EXHAUSTED`, try `asia-south1-b`
then `-c`. Quotas needed (already granted on the project): `GPUS_ALL_REGIONS`
= 1, `PREEMPTIBLE_NVIDIA_T4_GPUS` (asia-south1) = 1.

## One-time VM setup

```bash
gcloud compute ssh zumi-gpu-1 --zone=asia-south1-a
nvidia-smi                       # must show Tesla T4 before continuing

# Docker (the DLVM image does NOT ship it):
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# NVIDIA container toolkit (image may ship an older toolkit; an apt version
# conflict warning here is fine as long as the GPU test below passes):
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
newgrp docker

# GPU-in-container smoke test -- must print the T4 table:
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi

# Services (copy docker-compose.yml from this directory to ~/zumi-infra):
mkdir -p ~/zumi-infra   # then scp/paste docker-compose.yml there
cd ~/zumi-infra && docker compose up -d

# Install the Whisper models once (persist on the disk):
curl -X POST "http://localhost:8000/v1/models/Systran%2Ffaster-whisper-medium.en"
curl -X POST "http://localhost:8000/v1/models/Systran%2Ffaster-whisper-small.en"
```

## Firewall (benchmark phase)

Ports 8880/8000 are opened ONLY to the developer's current IPv4
(home connections rotate IPs -- update the rule when curls start timing out):

```bash
curl -4 -s ifconfig.me    # on the laptop

gcloud compute firewall-rules create zumi-gpu-bench \
  --allow=tcp:8880,tcp:8000 --source-ranges=YOUR_IPV4/32 --target-tags=zumi-gpu
gcloud compute instances add-tags zumi-gpu-1 --tags=zumi-gpu --zone=asia-south1-a

# later, when the IP changes:
gcloud compute firewall-rules update zumi-gpu-bench --source-ranges=NEW_IPV4/32
```

Phase 5/6 will replace this with proper token auth before any child audio
touches the box.

## Daily start/stop

```bash
gcloud compute instances start zumi-gpu-1 --zone=asia-south1-a   # containers auto-start (restart: unless-stopped)
gcloud compute instances stop  zumi-gpu-1 --zone=asia-south1-a   # ALWAYS after a session
gcloud compute instances list                                    # external IP changes on every start
```

## Verify (from the laptop, not the VM)

```bash
VM_IP=$(gcloud compute instances describe zumi-gpu-1 --zone=asia-south1-a \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)')

curl -s http://$VM_IP:8880/v1/audio/voices | head -c 200     # Kokoro up
curl -s http://$VM_IP:8000/v1/models                          # Whisper up

# TTS timing. time_starttransfer = TTFB (when audio STARTS streaming -- the
# number Phase 6 cares about); time_total = full synthesis.
curl -s -o /tmp/gpu.wav -w 'TTS ttfb: %{time_starttransfer}s total: %{time_total}s\n' \
  -X POST http://$VM_IP:8880/v1/audio/speech \
  -H 'Content-Type: application/json' \
  -d '{"model":"kokoro","voice":"af_heart","input":"Oh wow! Today we are going to learn about plants.","response_format":"pcm"}'

# STT timing:
curl -s -w '\nSTT: %{time_total}s\n' -X POST http://$VM_IP:8000/v1/audio/transcriptions \
  -F file=@/tmp/gpu.wav -F model=Systran/faster-whisper-medium.en
```

## Benchmark results (2026-08-04, T4 spot, measured from the dev laptop in India)

TTS -- one 6s Hindi sentence, voice `hf_alpha`, identical output bytes,
full-file download (Phase 6 streaming will cut perceived latency further):

| Backend | Warm latency |
|---|---|
| GPU T4 (this VM) | **0.53–0.55 s** (first call 0.82 s) |
| CPU (dev laptop, current production path) | 2.58–2.85 s |

STT -- clean synthetic speech (Kokoro-generated; real child audio in Phase 5
will be harder), transcripts were word-perfect on every run:

| Clip | `medium.en` | `small.en` |
|---|---|---|
| 5.4 s | 0.84–1.04 s | -- |
| 15.4 s | 1.36–1.46 s | 0.94–1.07 s |

Verdict: **T4 passes the Phase 4 go/no-go** (TTS ≈ target 0.5 s; STT < 1 s
on a typical utterance). No L4 upgrade needed for Phases 5–6; the
`PREEMPTIBLE_NVIDIA_L4_GPUS` quota (1, asia-south1) is pre-approved if that
changes. Recommended Phase 5 model: `medium.en` (accuracy headroom over
`small.en` is worth ~0.4 s on long turns).
