/**
 * 提供商列表组件
 * 管理 API 提供商：新增 / 编辑（名称、baseUrl、apiKey）/ 删除
 */

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Server } from 'lucide-react';
import { ModelProvider } from '../../types/model';
import {
  getProviders,
  addProvider,
  updateProvider,
  removeProvider,
} from '../../services/modelRegistry';
import { useAlert } from '../GlobalAlert';

interface ProviderListProps {
  onRefresh: () => void;
}

const ProviderList: React.FC<ProviderListProps> = ({ onRefresh }) => {
  const [providers, setProviders] = useState<ModelProvider[]>(() => getProviders());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', baseUrl: '', apiKey: '', useProxy: false });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', baseUrl: '', apiKey: '', useProxy: false });
  const { showAlert } = useAlert();

  const reload = () => setProviders(getProviders());

  const handleStartEdit = (p: ModelProvider) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey: p.apiKey || '',
      useProxy: Boolean(p.useProxy),
    });
  };

  const handleSaveEdit = (p: ModelProvider) => {
    if (!editForm.name.trim()) {
      showAlert('提供商名称不能为空', { type: 'warning' });
      return;
    }
    if (!p.isBuiltIn && !editForm.baseUrl.trim()) {
      showAlert('API 基础 URL 不能为空', { type: 'warning' });
      return;
    }
    updateProvider(p.id, {
      name: editForm.name.trim(),
      baseUrl: editForm.baseUrl.trim().replace(/\/+$/, ''),
      apiKey: editForm.apiKey.trim() || undefined,
      useProxy: editForm.useProxy,
    });
    setEditingId(null);
    reload();
    onRefresh();
    showAlert('提供商已更新', { type: 'success' });
  };

  const handleAdd = () => {
    if (!newForm.name.trim() || !newForm.baseUrl.trim()) {
      showAlert('请填写提供商名称和 API 基础 URL', { type: 'warning' });
      return;
    }
    addProvider({
      name: newForm.name.trim(),
      baseUrl: newForm.baseUrl.trim().replace(/\/+$/, ''),
      apiKey: newForm.apiKey.trim() || undefined,
      isDefault: false,
      useProxy: newForm.useProxy,
    });
    setNewForm({ name: '', baseUrl: '', apiKey: '', useProxy: false });
    setIsAdding(false);
    reload();
    onRefresh();
    showAlert('提供商添加成功', { type: 'success' });
  };

  const handleDelete = (p: ModelProvider) => {
    if (p.isBuiltIn) return;
    showAlert(
      `确定要删除提供商「${p.name}」吗？该提供商下的所有自定义模型也会被一并删除。`,
      {
        type: 'warning',
        showCancel: true,
        onConfirm: () => {
          removeProvider(p.id);
          reload();
          onRefresh();
          showAlert('提供商已删除', { type: 'success' });
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-hover)]/50 border border-[var(--border-secondary)] rounded-lg p-3 flex items-start gap-2">
        <Server className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
          提供商定义了 baseUrl 与该提供商下所有模型共享的 API Key。
          内置提供商不可删除、baseUrl 锁定，但可单独配置 API Key。
        </p>
      </div>

      <div className="space-y-2">
        {providers.map((p) => (
          <div
            key={p.id}
            className={`bg-[var(--bg-elevated)]/50 border rounded-lg p-3 ${
              p.isDefault ? 'border-[var(--accent-border)]' : 'border-[var(--border-primary)]'
            }`}
          >
            {editingId === p.id ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">提供商名称</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">
                    API 基础 URL{p.isBuiltIn && '（内置不可修改）'}
                  </label>
                  <input
                    type="text"
                    value={editForm.baseUrl}
                    onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
                    disabled={p.isBuiltIn}
                    placeholder="如：https://api.openai.com"
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">API Key（可选）</label>
                  <input
                    type="password"
                    value={editForm.apiKey}
                    onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
                    placeholder="该提供商下所有模型共享的 Key，留空使用全局 Key"
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
                  />
                </div>
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.useProxy}
                    onChange={(e) => setEditForm({ ...editForm, useProxy: e.target.checked })}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <div>
                    <span className="text-xs text-[var(--text-secondary)]">通过本地反向代理调用</span>
                    <p className="text-[9px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                      勾选后请求会经由 <span className="font-mono">/api/inference-proxy</span> 转发，
                      解决厂商（如 DashScope / Volcengine）不返回 CORS 头时浏览器无法直连的问题。
                    </p>
                  </div>
                </label>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleSaveEdit(p)}
                    className="flex-1 py-2 bg-[var(--accent)] text-[var(--text-primary)] text-xs rounded hover:bg-[var(--accent-hover)] flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    保存
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 bg-[var(--bg-hover)] text-[var(--text-tertiary)] text-xs rounded hover:bg-[var(--border-secondary)]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{p.name}</span>
                    {p.isDefault && (
                      <span className="px-1.5 py-0.5 bg-[var(--accent-bg)] text-[var(--accent-text)] text-[10px] rounded">默认</span>
                    )}
                    {p.isBuiltIn && (
                      <span className="px-1.5 py-0.5 bg-[var(--border-secondary)] text-[var(--text-tertiary)] text-[10px] rounded">内置</span>
                    )}
                    {p.apiKey?.trim() && (
                      <span className="px-1.5 py-0.5 bg-[var(--accent-bg)] text-[var(--accent-text)] text-[10px] rounded">已配置 Key</span>
                    )}
                    {p.useProxy && (
                      <span className="px-1.5 py-0.5 bg-[var(--accent-bg)] text-[var(--accent-text)] text-[10px] rounded">代理</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5 truncate">{p.baseUrl}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleStartEdit(p)}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {!p.isBuiltIn && (
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error-text)] transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isAdding ? (
        <div className="bg-[var(--bg-elevated)]/50 border border-[var(--border-secondary)] rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-bold text-[var(--text-primary)]">添加新提供商</h4>
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">提供商名称 *</label>
            <input
              type="text"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              placeholder="如：OpenAI Official"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">API 基础 URL *</label>
            <input
              type="text"
              value={newForm.baseUrl}
              onChange={(e) => setNewForm({ ...newForm, baseUrl: e.target.value })}
              placeholder="如：https://api.openai.com"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">API Key（可选）</label>
            <input
              type="password"
              value={newForm.apiKey}
              onChange={(e) => setNewForm({ ...newForm, apiKey: e.target.value })}
              placeholder="留空则使用全局 Key"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-secondary)] rounded px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono"
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newForm.useProxy}
              onChange={(e) => setNewForm({ ...newForm, useProxy: e.target.checked })}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <div>
              <span className="text-xs text-[var(--text-secondary)]">通过本地反向代理调用</span>
              <p className="text-[9px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                厂商不返回 CORS 头时勾选（如 DashScope / Volcengine）。请求会被本地 <span className="font-mono">/api/inference-proxy</span> 转发到目标地址。
              </p>
            </div>
          </label>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              className="flex-1 py-2.5 bg-[var(--accent)] text-[var(--text-primary)] text-xs font-bold rounded hover:bg-[var(--accent-hover)] flex items-center justify-center gap-1"
            >
              <Check className="w-3 h-3" />
              添加提供商
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewForm({ name: '', baseUrl: '', apiKey: '' });
              }}
              className="px-4 py-2.5 bg-[var(--bg-hover)] text-[var(--text-tertiary)] text-xs rounded hover:bg-[var(--border-secondary)]"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-3 border border-dashed border-[var(--border-secondary)] rounded-lg text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-secondary)] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加提供商
        </button>
      )}
    </div>
  );
};

export default ProviderList;
