'use client';

import type { CurrentUser } from '@recallify/contracts';
import { formatDate, formatPercent } from '@recallify/core';
import {
  useAiUsage,
  useApi,
  useMe,
  useUpdateSettings,
  useWorkload,
} from '@recallify/core/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FillBar } from '@/components/motion';
import { PageShell, Section } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { Segmented, Slider } from '@/components/ui/controls';
import { ConfirmDialog } from '@/components/ui/dialog';
import { PasswordField, TextField } from '@/components/ui/field';
import { ErrorState, Skeleton, messageOf } from '@/components/ui/misc';
import { logout } from '@/lib/auth';
import { applyTheme, readTheme, type ThemeChoice } from '@/lib/theme';

export function SettingsView() {
  const me = useMe();

  return (
    <PageShell title="Settings" width="prose">
      {me.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : me.isError || !me.data ? (
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      ) : (
        <div className="flex flex-col gap-10">
          <Profile user={me.data} />
          <Scheduling user={me.data} />
          <Appearance />
          <AiAllowance />
          <Account user={me.data} />
        </div>
      )}
    </PageShell>
  );
}

function Profile({ user }: { user: CurrentUser }) {
  const [name, setName] = useState(user.displayName ?? '');
  const update = useUpdateSettings();
  const dirty = name.trim() !== (user.displayName ?? '') && name.trim().length > 0;

  return (
    <Section title="Profile">
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate(
            { displayName: name.trim() },
            {
              onSuccess: () => toast.success('Name saved.'),
              onError: (error) => toast.error(messageOf(error)),
            },
          );
        }}
      >
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <TextField
          label="Email"
          value={user.email}
          disabled
          readOnly
          hint={`Member since ${formatDate(user.createdAt)}.`}
        />
        <div>
          <Button
            type="submit"
            variant="primary"
            disabled={!dirty}
            loading={update.isPending}
          >
            Save name
          </Button>
        </div>
      </form>
    </Section>
  );
}

/**
 * The retention target, with its price.
 *
 * Every spaced-repetition app has this setting; most bury it because the cost
 * is invisible. Here the daily workload at each position comes back from the
 * server in one response, so dragging the slider shows what the number buys
 * and what it costs before anything is saved.
 */
function Scheduling({ user }: { user: CurrentUser }) {
  const workload = useWorkload();
  const update = useUpdateSettings();

  const [retention, setRetention] = useState(user.desiredRetention);
  const [newLimit, setNewLimit] = useState(String(user.dailyNewLimit));
  const [reviewLimit, setReviewLimit] = useState(String(user.dailyReviewLimit));

  const points = workload.data?.points ?? [];
  const at = (r: number) =>
    points.find((p) => Math.abs(p.retention - r) < 0.005)?.reviewsPerDay ?? null;
  const now = at(user.desiredRetention);
  const then = at(retention);
  const changed = Math.abs(retention - user.desiredRetention) > 0.001;

  const limitsDirty =
    Number(newLimit) !== user.dailyNewLimit ||
    Number(reviewLimit) !== user.dailyReviewLimit;
  const limitsValid =
    /^\d{1,4}$/.test(newLimit.trim()) && /^\d{1,4}$/.test(reviewLimit.trim());

  return (
    <Section title="Scheduling">
      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-ui font-medium text-ink">Retention target</span>
          <span className="tabular text-data-lg font-medium text-ink">
            {formatPercent(retention)}
          </span>
        </div>
        <p className="mt-1 text-ui text-ink-muted">
          How likely you want to be to recall a card at the moment it comes back.
        </p>

        <div className="mt-5">
          <Slider
            label="Retention target"
            value={Math.round(retention * 100)}
            min={70}
            max={97}
            step={1}
            onChange={(value) => setRetention(value / 100)}
          />
          <div className="tabular mt-1 flex justify-between text-[10px] text-ink-faint">
            <span>70%</span>
            <span>97%</span>
          </div>
        </div>

        <div className="mt-4 min-h-12 border-t border-line pt-4 text-ui text-ink-muted">
          {workload.isLoading ? (
            <Skeleton className="h-4 w-64" />
          ) : workload.data && workload.data.cardsCounted === 0 ? (
            'No cards have graduated to review yet, so there is no workload to estimate.'
          ) : then !== null ? (
            <>
              About <span className="tabular text-ink">{then.toFixed(1)}</span> reviews a
              day at this target
              {changed && now !== null ? (
                <>
                  , against <span className="tabular text-ink">{now.toFixed(1)}</span> now
                  (
                  <span className="tabular text-ink">
                    {then >= now ? '+' : ''}
                    {now > 0 ? Math.round(((then - now) / now) * 100) : 0}%
                  </span>
                  )
                </>
              ) : null}
              . An estimate from{' '}
              <span className="tabular">{workload.data?.cardsCounted}</span> cards in
              review. It leaves out lapses and new cards.
            </>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={!changed}
            loading={update.isPending && changed}
            onClick={() =>
              update.mutate(
                { desiredRetention: retention },
                {
                  onSuccess: () =>
                    toast.success(
                      'Target saved. It applies from each card’s next review.',
                    ),
                  onError: (error) => toast.error(messageOf(error)),
                },
              )
            }
          >
            Save target
          </Button>
          {changed ? (
            <Button variant="ghost" onClick={() => setRetention(user.desiredRetention)}>
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      <form
        className="mt-6 grid gap-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate(
            { dailyNewLimit: Number(newLimit), dailyReviewLimit: Number(reviewLimit) },
            {
              onSuccess: () => toast.success('Daily limits saved.'),
              onError: (error) => toast.error(messageOf(error)),
            },
          );
        }}
      >
        <TextField
          label="New cards a day"
          inputMode="numeric"
          value={newLimit}
          onChange={(e) => setNewLimit(e.target.value)}
          hint="New cards are what gets cut when a day is already full."
          className="tabular"
        />
        <TextField
          label="Reviews a day"
          inputMode="numeric"
          value={reviewLimit}
          onChange={(e) => setReviewLimit(e.target.value)}
          hint="A ceiling, so a backlog cannot become a wall."
          className="tabular"
        />
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={!limitsDirty || !limitsValid}
            loading={update.isPending && !changed}
          >
            Save limits
          </Button>
        </div>
      </form>
    </Section>
  );
}

function Appearance() {
  // Read after mount: the stored choice lives in the browser, and rendering it
  // on the server would guess wrong and flicker.
  const [theme, setTheme] = useState<ThemeChoice>('system');
  useEffect(() => setTheme(readTheme()), []);

  return (
    <Section title="Appearance">
      <Segmented
        label="Theme"
        value={theme}
        onChange={(choice) => {
          setTheme(choice);
          applyTheme(choice);
        }}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ]}
        className="w-full sm:w-auto"
      />
      <p className="mt-2 text-caption text-ink-muted">
        Light unless you say otherwise. Remembered on this device only.
      </p>
    </Section>
  );
}

function AiAllowance() {
  const usage = useAiUsage();

  return (
    <Section title="AI card drafts">
      {usage.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : usage.isError || !usage.data ? (
        <ErrorState error={usage.error} onRetry={() => void usage.refetch()} />
      ) : (
        <>
          <div className="flex items-baseline justify-between text-ui text-ink-muted">
            <span>
              <span className="tabular text-ink">{usage.data.usedToday}</span> of{' '}
              <span className="tabular text-ink">{usage.data.dailyLimit}</span> cards
              drafted today
            </span>
            <span className="tabular text-caption">resets 00:00 UTC</span>
          </div>
          <FillBar
            className="mt-2"
            ratio={
              usage.data.dailyLimit > 0 ? usage.data.usedToday / usage.data.dailyLimit : 0
            }
          />
          <p className="mt-3 text-caption text-ink-muted">
            Drafting runs on a free model tier shared by everyone, which is why it is
            capped. Failed attempts are not charged.
          </p>
        </>
      )}
    </Section>
  );
}

function Account({ user }: { user: CurrentUser }) {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const leave = async () => {
    await logout().catch(() => undefined);
    queryClient.clear();
    router.replace('/');
  };

  const remove = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.deleteAccount(password);
      toast.success('Account deleted.');
      await leave();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Account">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ui text-ink-muted">
          Signed in as <span className="text-ink">{user.email}</span>.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => void leave()}>Sign out</Button>
          {user.isDemo ? null : (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Delete account
            </Button>
          )}
        </div>
      </div>
      {user.isDemo ? (
        <p className="mt-3 text-caption text-ink-muted">
          A demo account deletes itself a day after it was opened, with everything in
          it. Signing out ends it now: it cannot be signed in to again.
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) {
            setPassword('');
            setError(undefined);
          }
        }}
        title="Delete your account?"
        description="Every deck, every card and your whole review history are erased. This cannot be undone, and there is no backup to restore from."
        confirmLabel="Delete everything"
        loading={busy}
        onConfirm={() => void remove()}
      >
        <PasswordField
          label="Your password, to confirm"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
      </ConfirmDialog>
    </Section>
  );
}
