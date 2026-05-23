import { formatBytesPerSecond, type UploadProgressState } from '../lib/upload-progress';

interface Props {
  state: UploadProgressState | null;
}

export function UploadProgress({ state }: Props) {
  if (!state) return null;

  const isParsing = state.phase === 'parsing' || state.phase === 'complete';

  return (
    <div className="upload-progress" role="status" aria-live="polite">
      <ProgressRow
        label="Upload"
        percent={state.uploadPercent}
        detail={state.phase === 'uploading' ? formatBytesPerSecond(state.speedBytesPerSecond) : 'complete'}
      />
      <ProgressRow
        label="Server parsing"
        percent={isParsing ? state.parsePercent : 0}
        detail={isParsing ? `${(state.elapsedMs / 1000).toFixed(1)}s elapsed` : 'waiting'}
      />
    </div>
  );
}

function ProgressRow({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  const value = Math.round(percent);

  return (
    <div className="progress-row">
      <div className="progress-label">
        <span>{label}</span>
        <span>{value}% · {detail}</span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}