# Curated curriculum content

Source-of-truth JSON bundles imported into Firestore by
[`scripts/import-curriculum.ts`](../scripts/import-curriculum.ts). Each bundle
folder maps 1:1 to a `curriculum/{curriculumId}` doc in Firestore.

## Layout

```
content/
  {gradeId}/                  # e.g. cbse_8 -- one folder per class/grade
    {curriculumId}/           # e.g. cbse_8_science, cbse_8_math
      curriculum.json         # CurriculumDoc fields (board, grade, subject)
      {chapterId}/            # e.g. force_pressure
        chapter.json          # ChapterDoc fields (chapterNo, chapterName, status)
        topics/
          {topicId}.json      # TopicContent fields -- ONE file per topic
```

The importer walks grade folders recursively and finds every sub-folder
that contains a `curriculum.json` (so `content/cbse_8/cbse_8_math` is a
valid bundle path).

`curriculumId`, `chapterId`, and `topicId` are derived from the folder /
filename respectively (lowercase snake_case, validated by Zod).

## Validation

Every `topics/*.json` file is validated against
[`@zerebro/shared-types/schemas/topicContent`](../packages/shared-types/src/schemas/topicContent.ts)
before any Firestore write. Validation failures print the exact field path
(e.g. `quiz[2].correctIndex`) so the content editor can locate the issue
without grepping.

## Running the import

```bash
# Dry-run against the local emulator (default)
pnpm import:curriculum

# Apply against the emulator
pnpm import:curriculum -- --apply

# Apply against production (requires GOOGLE_APPLICATION_CREDENTIALS or ADC)
pnpm import:curriculum -- --apply --target=prod
```

Re-runs are safe -- the import is idempotent. Already-published topics keep
their `publishedAt` timestamp; only the mutable fields are refreshed.

## Sample bundle

`cbse_8/cbse_8_science/force_pressure/` ships with the repo as a small smoke
bundle (1 chapter, 4 topics) so the emulator seed script (`pnpm seed:staging`)
populates a working teacher Assign Topic flow out of the box. Larger bundles
delivered by the content team live OUTSIDE this repo (private Drive / git);
copy them into `content/{gradeId}/{curriculumId}/` only when explicitly running the
import.
