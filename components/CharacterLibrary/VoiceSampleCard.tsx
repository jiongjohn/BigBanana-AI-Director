import React, { useState } from 'react';
import { Mic, Trash2, Check, X, Edit3, Archive } from 'lucide-react';
import { VoiceSample } from '../../types';

interface VoiceSampleCardProps {
  voice: VoiceSample;
  onSave: (next: VoiceSample) => void;
  onDelete: () => void;
  onPublishToLibrary?: () => void; // 推到全局资产库（跨项目复用）
}

const formatDuration = (sec?: number): string => {
  if (!sec || !Number.isFinite(sec)) return '--';
  if (sec < 60) return `${sec.toFixed(1)} 秒`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return `${m} 分 ${s} 秒`;
};

const formatSize = (bytes: number): string => {
  if (!bytes) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const VoiceSampleCard: React.FC<VoiceSampleCardProps> = ({ voice, onSave, onDelete, onPublishToLibrary }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<VoiceSample>(voice);

  const handleSave = () => {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return;
    onSave({ ...draft, name: trimmedName });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(voice);
    setIsEditing(false);
  };

  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Mic className="w-4 h-4 text-[var(--accent-text)] flex-shrink-0" />
          {isEditing ? (
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="flex-1 min-w-0 px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-secondary)] text-sm text-[var(--text-primary)] outline-none"
              autoFocus
            />
          ) : (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)] truncate">{voice.name}</div>
              <div className="text-[10px] font-mono uppercase tracking-wide text-[var(--text-muted)] mt-0.5">
                Voice Sample · {voice.mimeType.replace('audio/', '')}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="p-1 text-[var(--accent-text)] hover:text-[var(--accent-text-hover)] transition-colors"
                title="保存"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancel}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title="取消"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {onPublishToLibrary && (
                <button
                  onClick={onPublishToLibrary}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors"
                  title="加入资产库（跨项目复用）"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title="编辑"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--error-text)] transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <audio
        src={voice.audioDataUrl}
        controls
        preload="metadata"
        className="w-full"
      />

      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-[var(--text-muted)]">
        <div>
          <div className="uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">时长</div>
          <div className="text-[var(--text-secondary)]">{formatDuration(voice.durationSec)}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">大小</div>
          <div className="text-[var(--text-secondary)]">{formatSize(voice.sizeBytes)}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">语言</div>
          <div className="text-[var(--text-secondary)]">{voice.language || '--'}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">语言</label>
            <input
              value={draft.language || ''}
              onChange={(e) => setDraft({ ...draft, language: e.target.value || undefined })}
              placeholder="如：中文 / English"
              className="w-full px-2 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-secondary)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">样本台词（可选）</label>
            <textarea
              value={draft.transcript || ''}
              onChange={(e) => setDraft({ ...draft, transcript: e.target.value || undefined })}
              placeholder="样本里说了什么内容，用于辨识"
              rows={2}
              className="w-full px-2 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-secondary)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
            />
          </div>
        </div>
      ) : (
        voice.transcript && (
          <div className="text-[11px] text-[var(--text-tertiary)] leading-relaxed border-t border-[var(--border-subtle)] pt-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] block mb-1">台词</span>
            {voice.transcript}
          </div>
        )
      )}
    </div>
  );
};

export default VoiceSampleCard;
