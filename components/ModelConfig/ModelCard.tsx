/**
 * 模型卡片组件
 * 显示单个模型的配置
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, ToggleLeft, ToggleRight, CheckCircle, Circle } from 'lucide-react';
import { 
  ModelDefinition, 
  ChatModelParams,
  ImageModelParams,
  VideoModelParams,
  AudioModelParams,
  AspectRatio,
  VideoDuration
} from '../../types/model';
import { getProviderById, getProviders } from '../../services/modelRegistry';

interface ModelCardProps {
  model: ModelDefinition;
  isExpanded: boolean;
  isActive: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<ModelDefinition>) => void;
  onDelete: () => void;
  onSetActive: () => void;
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isExpanded,
  isActive,
  onToggleExpand,
  onUpdate,
  onDelete,
  onSetActive,
}) => {
  const [editParams, setEditParams] = useState<any>(model.params);
  const [editApiKey, setEditApiKey] = useState<string>(model.apiKey || '');
  const [editName, setEditName] = useState<string>(model.name);
  const [editApiModel, setEditApiModel] = useState<string>(model.apiModel || '');
  const [editEndpoint, setEditEndpoint] = useState<string>(model.endpoint || '');
  const [editDescription, setEditDescription] = useState<string>(model.description || '');
  const [editProviderId, setEditProviderId] = useState<string>(model.providerId);
  const provider = getProviderById(model.providerId);
  const allProviders = getProviders();
  const isVolcengineModel = model.providerId === 'volcengine';
  const modelHasApiKey = Boolean(model.apiKey?.trim());
  const providerHasApiKey = Boolean(provider?.apiKey?.trim());
  const isMissingVolcengineKey = isVolcengineModel && !modelHasApiKey && !providerHasApiKey;

  const handleParamChange = (key: string, value: any) => {
    const newParams = { ...editParams, [key]: value };
    setEditParams(newParams);
    onUpdate({ params: newParams } as any);
  };

  const handleToggleEnabled = () => {
    onUpdate({ isEnabled: !model.isEnabled });
  };

  const handleApiKeyChange = (value: string) => {
    setEditApiKey(value);
    onUpdate({ apiKey: value.trim() || undefined });
  };

  const handleNameChange = (value: string) => {
    setEditName(value);
    const trimmed = value.trim();
    if (trimmed) onUpdate({ name: trimmed } as any);
  };

  const handleApiModelChange = (value: string) => {
    setEditApiModel(value);
    const trimmed = value.trim();
    if (trimmed) onUpdate({ apiModel: trimmed } as any);
  };

  const handleEndpointChange = (value: string) => {
    setEditEndpoint(value);
    onUpdate({ endpoint: value.trim() || undefined } as any);
  };

  const handleDescriptionChange = (value: string) => {
    setEditDescription(value);
    onUpdate({ description: value.trim() || undefined } as any);
  };

  const handleProviderChange = (value: string) => {
    setEditProviderId(value);
    onUpdate({ providerId: value } as any);
  };

  const renderChatParams = (params: ChatModelParams) => (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">温度</label>
        <input
          type="number"
          min="0"
          max="2"
          step="0.1"
          value={editParams.temperature}
          onChange={(e) => handleParamChange('temperature', parseFloat(e.target.value))}
          className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)]"
        />
      </div>
      <div>
        <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">最大 Token</label>
        <input
          type="number"
          min="1"
          max="128000"
          value={editParams.maxTokens ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            handleParamChange('maxTokens', value === '' ? undefined : parseInt(value));
          }}
          placeholder="留空不限制"
          className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)]"
        />
        <p className="text-[9px] text-[var(--text-muted)] mt-1">留空则不限制最大 Token</p>
      </div>
    </div>
  );

  const renderImageParams = (params: ImageModelParams) => (
    <div className="space-y-3">
      <div className="text-[10px] text-[var(--text-muted)]">
        协议：{params.apiFormat === 'openai' ? 'OpenAI Images' : 'Gemini GenerateContent'}
      </div>
      <div>
        <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">默认比例</label>
        <div className="flex gap-2">
          {/* 从模型的 supportedAspectRatios 读取支持的比例 */}
          {(params.supportedAspectRatios || ['16:9', '9:16']).map((ratio) => (
            <button
              key={ratio}
              onClick={() => handleParamChange('defaultAspectRatio', ratio)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                editParams.defaultAspectRatio === ratio
                  ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                  : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:bg-[var(--border-secondary)]'
              }`}
            >
              {ratio === '16:9' ? '横屏' : ratio === '9:16' ? '竖屏' : '方形'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderVideoParams = (params: VideoModelParams) => (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">默认比例</label>
        <div className="flex gap-2">
          {editParams.supportedAspectRatios.map((ratio: AspectRatio) => (
            <button
              key={ratio}
              onClick={() => handleParamChange('defaultAspectRatio', ratio)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                editParams.defaultAspectRatio === ratio
                  ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                  : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:bg-[var(--border-secondary)]'
              }`}
            >
              {ratio === '16:9' ? '横屏' : ratio === '9:16' ? '竖屏' : '方形'}
            </button>
          ))}
        </div>
      </div>
      {editParams.supportedDurations.length > 1 && (
        <div>
          <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">默认时长</label>
          <div className="flex gap-2">
            {editParams.supportedDurations.map((duration: VideoDuration) => (
              <button
                key={duration}
                onClick={() => handleParamChange('defaultDuration', duration)}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  editParams.defaultDuration === duration
                    ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:bg-[var(--border-secondary)]'
                }`}
              >
                {duration}秒
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="text-[10px] text-[var(--text-muted)]">
        模式：{
          editParams.mode === 'sync'
            ? '同步（Chat Completion）'
            : (model.endpoint || '').includes('/contents/generations/tasks')
              ? '异步（火山任务）'
              : '异步（Sora 类）'
        }
      </div>
    </div>
  );

  const renderAudioParams = (params: AudioModelParams) => {
    const apiFormatLabel =
      params.apiFormat === 'dashscope_tts'
        ? 'DashScope TTS（阿里）'
        : params.apiFormat === 'openai_speech'
          ? 'OpenAI Speech（/v1/audio/speech）'
          : 'OpenAI 多模态 Chat';
    const voicePlaceholder = params.apiFormat === 'dashscope_tts' ? 'Cherry' : 'alloy';
    return (
      <div className="space-y-3">
        <div className="text-[10px] text-[var(--text-muted)]">协议：{apiFormatLabel}</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">默认音色</label>
            <input
              type="text"
              value={editParams.defaultVoice || params.defaultVoice}
              onChange={(e) => handleParamChange('defaultVoice', e.target.value)}
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)]"
              placeholder={voicePlaceholder}
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">输出格式</label>
            <select
              value={editParams.outputFormat || params.outputFormat}
              onChange={(e) => handleParamChange('outputFormat', e.target.value)}
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)]"
            >
              <option value="wav">wav</option>
              <option value="mp3">mp3</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  const apiModelLabel = model.apiModel || model.id;

  return (
    <div 
      className={`bg-[var(--bg-elevated)]/50 border rounded-lg overflow-hidden transition-all ${
        isActive ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]' : 'border-[var(--border-primary)]'
      } ${!model.isEnabled ? 'opacity-60' : ''}`}
    >
      {/* 头部 */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {/* 模型信息 */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">{model.name}</span>
              {model.isBuiltIn && (
                <span className={`px-1.5 py-0.5 text-[9px] rounded ${
                  isVolcengineModel
                    ? 'bg-[var(--warning-bg)] text-[var(--warning-text)]'
                    : 'bg-[var(--border-secondary)] text-[var(--text-tertiary)]'
                }`}>
                  {isVolcengineModel ? '火山引擎' : '内置'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
              API 模型名: {apiModelLabel}
              {model.id !== apiModelLabel && ` · 内部ID: ${model.id}`}
              {model.endpoint && ` · ${model.endpoint}`}
              {model.description && ` · ${model.description}`}
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          {/* 使用此模型按钮 */}
          {model.isEnabled && !isActive && (
            <button
              onClick={onSetActive}
              className="px-2.5 py-1 bg-[var(--accent)] text-[var(--text-primary)] text-[10px] font-bold rounded hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-1"
              title="使用此模型"
            >
              <Circle className="w-3 h-3" />
              使用
            </button>
          )}
          
          {/* 当前激活标记 */}
          {isActive && (
            <span className="px-2.5 py-1 bg-[var(--accent-bg)] text-[var(--accent-text-hover)] text-[10px] font-bold rounded flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              当前使用
            </span>
          )}

          {/* 启用/禁用开关 */}
          <button
            onClick={handleToggleEnabled}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            title={model.isEnabled ? '禁用' : '启用'}
          >
            {model.isEnabled ? (
              <ToggleRight className="w-5 h-5 text-[var(--accent-text)]" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
          </button>

          {/* 删除按钮（仅非内置模型） */}
          {!model.isBuiltIn && (
            <button
              onClick={onDelete}
              className="text-[var(--text-tertiary)] hover:text-[var(--error-text)] transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* 展开/收起 */}
          <button
            onClick={onToggleExpand}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* 展开的参数配置 */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-[var(--border-primary)]">
          <div className="pt-4 space-y-4">
            {/* 自定义模型基础信息编辑 */}
            {!model.isBuiltIn && (
              <div className="space-y-3 pb-3 border-b border-[var(--border-primary)]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">模型名称</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="如：GPT-4 Turbo"
                      className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">API 模型名</label>
                    <input
                      type="text"
                      value={editApiModel}
                      onChange={(e) => handleApiModelChange(e.target.value)}
                      placeholder="如：gpt-4-turbo"
                      className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">描述</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    placeholder="可选的描述信息"
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">API 端点 (Endpoint)</label>
                  <input
                    type="text"
                    value={editEndpoint}
                    onChange={(e) => handleEndpointChange(e.target.value)}
                    placeholder="留空使用默认端点"
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">API 提供商</label>
                  <select
                    value={editProviderId}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)]"
                  >
                    {allProviders.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.baseUrl})</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-[var(--text-muted)] mt-1">
                    切换提供商会改变此模型实际请求的 baseUrl
                  </p>
                </div>
              </div>
            )}

            {/* 模型专属 API Key */}
            <div>
              <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                API Key（留空使用全局 Key）
              </label>
              {isVolcengineModel && (
                <p className="text-[9px] text-[var(--warning-text)] mb-1">
                  火山模型不会使用全局 API Key，请填写模型 Key 或 Volcengine 提供商 Key。
                </p>
              )}
              <input
                type="password"
                value={editApiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="留空则使用全局 API Key"
                className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
              />
              {isMissingVolcengineKey && (
                <p className="text-[9px] text-[var(--error-text)] mt-1">
                  未配置火山引擎 Key，当前模型无法调用且不会回退到全局 Key。
                </p>
              )}
              {model.apiKey && (
                <p className="text-[9px] text-[var(--success)] mt-1">✓ 已配置专属 Key</p>
              )}
            </div>
            
            {model.type === 'chat' && renderChatParams(model.params)}
            {model.type === 'image' && renderImageParams(model.params)}
            {model.type === 'video' && renderVideoParams(model.params)}
            {model.type === 'audio' && renderAudioParams(model.params)}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelCard;
