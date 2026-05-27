import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import firestore from '@react-native-firebase/firestore';

import {callFn} from '@zerebro/shared-firebase';
import {signOut} from '@zerebro/shared-firebase/auth';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {useAuthStore} from '../../state/authStore';
import {colors, radius, spacing} from '../../theme';

/**
 * P4.3 -- the teacher-side onboarding screen.
 *
 * Two states, swapped by `pending`:
 *   1. `pending === false` -- form: 6-char teacherCode + display name.
 *      Submit calls `requestTeacherJoin` which writes
 *      `schools/{schoolId}/teachers/{myUid}` status='pending' and
 *      returns `{schoolId, teacherId, status: 'pending'}`. We flip the
 *      local UI state immediately so the user sees the "Waiting" screen.
 *   2. `pending === true` -- waiting view with a `collectionGroup('teachers')
 *      .where('userId','==',myUid)` listener. When the principal approves
 *      via Campus, this listener never fires the "all approved" path
 *      directly -- instead the SIBLING listener in RootNavigator picks up
 *      the `users/{uid}.roles` array-union of 'teacher' and re-routes the
 *      whole nav to TeacherNavigator on the same tick. We surface
 *      `status: 'rejected'` here so the teacher sees the principal's
 *      reason and can re-submit with a new code.
 *
 * IMPORTANT: the listener uses the cross-school collection-group rule
 * `match /{path=**}/teachers/{teacherId}` (see firestore/rules) which
 * permits a self-read when `resource.data.userId == myUid()`. The query
 * is paired with the `teachers userId+status` composite index that
 * was deployed in Checkpoint A.
 *
 * `onBack` is passed in by RoleOnboardingGate so the teacher can return
 * to the intent picker if they hit the wrong button. Once the request
 * is `pending` we hide Back so a user can't accidentally abandon a
 * pending request and create confusion in the Campus queue.
 */
export function TeacherJoinScreen({onBack}: {onBack: () => void}) {
  const uid = useAuthStore(s => s.firebaseUid);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{
    schoolId: string;
    teacherId: string;
  } | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  // Subscribe to my OWN teacher request across all schools. Boots even
  // before the user fills the form -- if they already submitted a request
  // and killed the app, we jump straight to the pending view.
  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collectionGroup('teachers')
      .where('userId', '==', uid)
      .limit(1)
      .onSnapshot(
        snap => {
          const docSnap = snap.docs[0];
          if (!docSnap) {
            setPending(null);
            return;
          }
          const data = docSnap.data() as {
            status?: 'pending' | 'active' | 'rejected';
            rejectedReason?: string;
          };
          if (data.status === 'pending') {
            const schoolId = docSnap.ref.parent.parent?.id;
            if (schoolId) {
              setPending({schoolId, teacherId: docSnap.id});
              setRejection(null);
            }
          } else if (data.status === 'active') {
            // Don't try to flip the UI here -- RootNavigator's user-doc
            // listener will see roles=['teacher'] on the next snapshot
            // and unmount this whole gate, dropping us into the
            // TeacherNavigator on the same render tick. Showing a
            // "Success!" screen for the few ms in between would just
            // flash.
          } else if (data.status === 'rejected') {
            setPending(null);
            setRejection(data.rejectedReason ?? 'Your request was rejected.');
          }
        },
        err => console.warn('teacher pending listener', err),
      );
    return unsub;
  }, [uid]);

  async function onSubmit() {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (trimmedCode.length === 0) {
      Alert.alert('Missing code', 'Enter the code your principal shared.');
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert('Missing name', 'Enter your full name.');
      return;
    }
    try {
      setLoading(true);
      const out = await callFn<
        {teacherCode: string; displayName: string},
        {schoolId: string; teacherId: string; status: string}
      >('requestTeacherJoin', {
        teacherCode: trimmedCode,
        displayName: trimmedName,
      });
      setPending({schoolId: out.schoolId, teacherId: out.teacherId});
      setRejection(null);
    } catch (err) {
      Alert.alert(
        'Could not submit',
        (err as {message?: string} | null)?.message ??
          'Something went wrong. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (pending) {
    return <PendingView onSignOut={() => signOut().catch(() => {})} />;
  }

  return (
    <Screen
      title="Join your school"
      subtitle="Enter the 6-character code your principal shared with you, then submit for approval.">
      {rejection ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Your last request was rejected</Text>
          <Text style={styles.bannerBody}>{rejection}</Text>
          <Text style={styles.bannerBody}>
            Ask your principal for a fresh code and try again.
          </Text>
        </View>
      ) : null}

      <TextInput
        label="Teacher code"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={t => setCode(t.toUpperCase())}
        placeholder="ABCDEF"
        maxLength={6}
        style={styles.codeInput}
      />
      <TextInput
        label="Your full name"
        autoCapitalize="words"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Priya Sharma"
      />

      <Button title="Submit for approval" onPress={onSubmit} loading={loading} />

      <Pressable onPress={onBack}>
        <Text style={styles.linkMuted}>Back to options</Text>
      </Pressable>
    </Screen>
  );
}

function PendingView({onSignOut}: {onSignOut: () => void}) {
  return (
    <View style={styles.pendingContainer}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.pendingTitle}>Waiting for principal approval</Text>
      <Text style={styles.pendingBody}>
        Your request is in your principal's queue. The moment they approve
        it, ZConnect will switch you to the Teacher home automatically --
        no need to refresh or restart.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={styles.signOut}
        onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
  },
  linkMuted: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  banner: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
    gap: spacing.xs,
  },
  bannerTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  bannerBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  pendingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  pendingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  pendingBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 360,
  },
  signOut: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
