import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Plus, Users, MapPin, Package, Loader2, Search, Mic, UploadCloud, DownloadCloud } from 'lucide-react';
import { useProjectContext } from '../../contexts/ProjectContext';
import { useAlert } from '../GlobalAlert';
import { Character, Scene, Prop, VoiceSample } from '../../types';
import { convertImageToBase64, saveAssetToLibrary } from '../../services/storageService';
import { createLibraryItemFromVoice } from '../../services/assetLibraryService';
import AssetLibraryEditorCard, { LibraryAsset, LibraryAssetType } from './AssetLibraryEditorCard';
import VoiceSampleCard from './VoiceSampleCard';

type LibraryTabKey = LibraryAssetType | 'voice';

const TABS: Array<{ key: LibraryTabKey; label: string }> = [
  { key: 'character', label: '角色库' },
  { key: 'scene', label: '场景库' },
  { key: 'prop', label: '道具库' },
  { key: 'voice', label: '音色库' },
];

const isValidTab = (value: string | null): value is LibraryTabKey =>
  value === 'character' || value === 'scene' || value === 'prop' || value === 'voice';

const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// MiMo-V2.5-TTS-VoiceClone 单样本上限 10MB（base64 前的原始字节数）
const VOICE_SAMPLE_MAX_BYTES = 10 * 1024 * 1024;

const ACCEPTED_VOICE_MIME: Record<string, VoiceSample['mimeType']> = {
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mp3',
};

// 部分浏览器对 wav 文件返回空 file.type，需要按扩展名兜底。
const resolveVoiceMime = (file: File): VoiceSample['mimeType'] | null => {
  const direct = ACCEPTED_VOICE_MIME[file.type as keyof typeof ACCEPTED_VOICE_MIME];
  if (direct) return direct;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  return null;
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('读取音频文件失败'));
    reader.readAsDataURL(file);
  });

const probeAudioDuration = (dataUrl: string): Promise<number | undefined> =>
  new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
    };
    const onLoaded = () => {
      const d = audio.duration;
      cleanup();
      resolve(Number.isFinite(d) ? d : undefined);
    };
    const onError = () => {
      cleanup();
      resolve(undefined);
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.src = dataUrl;
  });

const CharacterLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showAlert } = useAlert();
  const {
    project,
    loading,
    allEpisodes,
    addCharacterToLibrary,
    updateCharacterInLibrary,
    removeCharacterFromLibrary,
    addSceneToLibrary,
    updateSceneInLibrary,
    removeSceneFromLibrary,
    addPropToLibrary,
    updatePropInLibrary,
    removePropFromLibrary,
    addVoiceToLibrary,
    updateVoiceInLibrary,
    removeVoiceFromLibrary,
    bulkPersistEpisodes,
  } = useProjectContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LibraryTabKey>('character');
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [newCharacterForm, setNewCharacterForm] = useState({ name: '', gender: '', age: '', personality: '' });
  const [newSceneForm, setNewSceneForm] = useState({ location: '', time: '', atmosphere: '' });
  const [newPropForm, setNewPropForm] = useState({ name: '', category: '', description: '' });
  const [newVoiceDraft, setNewVoiceDraft] = useState<VoiceSample | null>(null);
  const [voiceUploadBusy, setVoiceUploadBusy] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isValidTab(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  if (loading || !project) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <Loader2 className="w-6 h-6 text-[var(--text-muted)] animate-spin" />
      </div>
    );
  }

  const characters = project.characterLibrary || [];
  const scenes = project.sceneLibrary || [];
  const props = project.propLibrary || [];
  const voices = project.voiceLibrary || [];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCharacters = useMemo(
    () =>
      normalizedQuery
        ? characters.filter((char) =>
            [char.name, char.gender, char.age, char.personality, char.visualPrompt || '', char.coreFeatures || '']
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          )
        : characters,
    [characters, normalizedQuery]
  );

  const filteredScenes = useMemo(
    () =>
      normalizedQuery
        ? scenes.filter((scene) =>
            [scene.location, scene.time, scene.atmosphere, scene.visualPrompt || '']
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          )
        : scenes,
    [scenes, normalizedQuery]
  );

  const filteredProps = useMemo(
    () =>
      normalizedQuery
        ? props.filter((prop) =>
            [prop.name, prop.category, prop.description, prop.visualPrompt || '']
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          )
        : props,
    [props, normalizedQuery]
  );

  const filteredVoices = useMemo(
    () =>
      normalizedQuery
        ? voices.filter((voice) =>
            [voice.name, voice.language || '', voice.transcript || '']
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          )
        : voices,
    [voices, normalizedQuery]
  );

  const getCharacterRefCount = (characterId: string): number =>
    allEpisodes.filter((ep) => ep.scriptData?.characters.some((char) => char.libraryId === characterId)).length;

  const getSceneRefCount = (sceneId: string): number =>
    allEpisodes.filter((ep) => ep.scriptData?.scenes.some((scene) => scene.libraryId === sceneId)).length;

  const getPropRefCount = (propId: string): number =>
    allEpisodes.filter((ep) => (ep.scriptData?.props || []).some((prop) => prop.libraryId === propId)).length;

  const switchTab = (nextTab: LibraryTabKey) => {
    setActiveTab(nextTab);
    const nextSearch = new URLSearchParams(searchParams);
    nextSearch.set('tab', nextTab);
    setSearchParams(nextSearch, { replace: true });
    setShowAddModal(false);
    setNewVoiceDraft(null);
  };

  const confirmDeleteAsset = (
    assetTypeLabel: string,
    assetName: string,
    refCount: number,
    onConfirm: () => void
  ) => {
    const msg =
      refCount > 0
        ? `${assetTypeLabel}“${assetName}”已被 ${refCount} 集引用，删除后各集中的引用副本将变为独立${assetTypeLabel}。确定删除？`
        : `确定从${assetTypeLabel}库删除“${assetName}”吗？`;
    showAlert(msg, { type: 'warning', showCancel: true, onConfirm });
  };

  const uploadAssetImage = async <T extends Character | Scene | Prop>(
    asset: T,
    updater: (nextAsset: T) => void,
    file: File
  ) => {
    try {
      const base64 = await convertImageToBase64(file);
      updater({ ...asset, referenceImage: base64, status: 'completed' as const });
    } catch (error) {
      showAlert(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`, { type: 'error' });
    }
  };

  const handleDeleteCharacter = (character: Character) =>
    confirmDeleteAsset('角色', character.name, getCharacterRefCount(character.id), () => removeCharacterFromLibrary(character.id));

  const handleDeleteScene = (scene: Scene) =>
    confirmDeleteAsset('场景', scene.location, getSceneRefCount(scene.id), () => removeSceneFromLibrary(scene.id));

  const handleDeleteProp = (prop: Prop) =>
    confirmDeleteAsset('道具', prop.name, getPropRefCount(prop.id), () => removePropFromLibrary(prop.id));

  const handleDeleteVoice = (voice: VoiceSample) =>
    showAlert(`确定从音色库删除"${voice.name}"吗？删除后无法恢复。`, {
      type: 'warning',
      showCancel: true,
      onConfirm: () => removeVoiceFromLibrary(voice.id),
    });

  // 从本项目所有剧集扫描没链接到项目库的角色/场景/道具，按 name 去重，
  // 推到对应项目库并把所有相关剧集的实例 link 上去（设置 libraryId + 同步 refs）。
  const handleImportFromAllEpisodes = async () => {
    if (allEpisodes.length === 0) {
      showAlert('当前项目没有剧集可供导入', { type: 'warning' });
      return;
    }
    const libCharNames = new Set(characters.map(c => c.name));
    const libSceneKeys = new Set(scenes.map(s => s.location));
    const libPropNames = new Set(props.map(p => p.name));

    const newCharByName = new Map<string, Character>();
    const newSceneByKey = new Map<string, Scene>();
    const newPropByName = new Map<string, Prop>();

    for (const ep of allEpisodes) {
      if (!ep.scriptData) continue;
      for (const c of ep.scriptData.characters) {
        if (c.libraryId) continue;
        if (libCharNames.has(c.name) || newCharByName.has(c.name)) continue;
        const libId = createId('char');
        newCharByName.set(c.name, {
          ...c,
          id: libId,
          libraryId: undefined,
          libraryVersion: undefined,
          version: 1,
          variations: (c.variations || []).map(v => ({ ...v })),
        });
      }
      for (const s of ep.scriptData.scenes) {
        if (s.libraryId) continue;
        if (libSceneKeys.has(s.location) || newSceneByKey.has(s.location)) continue;
        const libId = createId('scene');
        newSceneByKey.set(s.location, {
          ...s,
          id: libId,
          libraryId: undefined,
          libraryVersion: undefined,
          version: 1,
        });
      }
      for (const p of (ep.scriptData.props || [])) {
        if (p.libraryId) continue;
        if (libPropNames.has(p.name) || newPropByName.has(p.name)) continue;
        const libId = createId('prop');
        newPropByName.set(p.name, {
          ...p,
          id: libId,
          libraryId: undefined,
          libraryVersion: undefined,
          version: 1,
        });
      }
    }

    const newChars = Array.from(newCharByName.values());
    const newScenes = Array.from(newSceneByKey.values());
    const newProps = Array.from(newPropByName.values());

    if (newChars.length === 0 && newScenes.length === 0 && newProps.length === 0) {
      showAlert('没有可导入的新条目（剧集中的资产要么已链接，要么名称已存在于项目库）', { type: 'info' });
      return;
    }

    newChars.forEach(c => addCharacterToLibrary(c));
    newScenes.forEach(s => addSceneToLibrary(s));
    newProps.forEach(p => addPropToLibrary(p));

    // 同时回写所有相关剧集的实例 libraryId + xxxRefs
    const nameToCharLibId = new Map<string, string>(newChars.map(c => [c.name, c.id]));
    const keyToSceneLibId = new Map<string, string>(newScenes.map(s => [s.location, s.id]));
    const nameToPropLibId = new Map<string, string>(newProps.map(p => [p.name, p.id]));
    // 已存在于项目库的也补一下链接（按 name 匹配）
    characters.forEach(c => { if (!nameToCharLibId.has(c.name)) nameToCharLibId.set(c.name, c.id); });
    scenes.forEach(s => { if (!keyToSceneLibId.has(s.location)) keyToSceneLibId.set(s.location, s.id); });
    props.forEach(p => { if (!nameToPropLibId.has(p.name)) nameToPropLibId.set(p.name, p.id); });

    const touchedEpisodes = allEpisodes
      .filter(ep => ep.scriptData)
      .map(ep => {
        const scriptData = ep.scriptData!;
        const newCharacters = scriptData.characters.map(c => {
          if (c.libraryId) return c;
          const libId = nameToCharLibId.get(c.name);
          return libId ? { ...c, libraryId: libId, libraryVersion: 1 } : c;
        });
        const newSceneArr = scriptData.scenes.map(s => {
          if (s.libraryId) return s;
          const libId = keyToSceneLibId.get(s.location);
          return libId ? { ...s, libraryId: libId, libraryVersion: 1 } : s;
        });
        const newPropArr = (scriptData.props || []).map(p => {
          if (p.libraryId) return p;
          const libId = nameToPropLibId.get(p.name);
          return libId ? { ...p, libraryId: libId, libraryVersion: 1 } : p;
        });

        const characterRefs = [...(ep.characterRefs || [])];
        newCharacters.forEach(c => {
          if (c.libraryId && !characterRefs.some(r => r.characterId === c.libraryId)) {
            characterRefs.push({ characterId: c.libraryId, syncedVersion: c.libraryVersion || 1, syncStatus: 'synced' });
          }
        });
        const sceneRefs = [...(ep.sceneRefs || [])];
        newSceneArr.forEach(s => {
          if (s.libraryId && !sceneRefs.some(r => r.sceneId === s.libraryId)) {
            sceneRefs.push({ sceneId: s.libraryId, syncedVersion: s.libraryVersion || 1, syncStatus: 'synced' });
          }
        });
        const propRefs = [...(ep.propRefs || [])];
        newPropArr.forEach(p => {
          if (p.libraryId && !propRefs.some(r => r.propId === p.libraryId)) {
            propRefs.push({ propId: p.libraryId, syncedVersion: p.libraryVersion || 1, syncStatus: 'synced' });
          }
        });

        return {
          ...ep,
          scriptData: { ...scriptData, characters: newCharacters, scenes: newSceneArr, props: newPropArr },
          characterRefs,
          sceneRefs,
          propRefs,
        };
      });

    try {
      await bulkPersistEpisodes(touchedEpisodes);
      showAlert(
        `已导入到项目库：角色 ${newChars.length}、场景 ${newScenes.length}、道具 ${newProps.length}；剧集已自动建立链接`,
        { type: 'success' }
      );
    } catch (e: any) {
      showAlert(`项目库已更新，但部分剧集回写失败：${e?.message || '未知错误'}`, { type: 'warning' });
    }
  };

  const handlePublishVoiceToLibrary = async (voice: VoiceSample) => {
    try {
      const item = createLibraryItemFromVoice(voice, project);
      await saveAssetToLibrary(item);
      showAlert(`已加入资产库：${voice.name}`, { type: 'success' });
    } catch (e: any) {
      showAlert(e?.message || '加入资产库失败', { type: 'error' });
    }
  };

  const handlePickVoiceFile = async (file: File | null) => {
    if (!file) return;
    const mime = resolveVoiceMime(file);
    if (!mime) {
      showAlert(`仅支持 mp3 / wav 格式的音频样本（检测到 ${file.type || '未知'} / ${file.name}）`, { type: 'error' });
      return;
    }
    if (file.size > VOICE_SAMPLE_MAX_BYTES) {
      showAlert(`样本大小 ${(file.size / 1024 / 1024).toFixed(1)}MB 超过 10MB 上限，请压缩或裁剪后再上传`, { type: 'error' });
      return;
    }
    setVoiceUploadBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const durationSec = await probeAudioDuration(dataUrl);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      setNewVoiceDraft({
        id: createId('voice'),
        name: baseName || '未命名样本',
        audioDataUrl: dataUrl,
        mimeType: mime,
        sizeBytes: file.size,
        durationSec,
        compatibleProtocols: ['mimo_tts'],
      });
    } catch (error) {
      showAlert(`读取音频失败: ${error instanceof Error ? error.message : '未知错误'}`, { type: 'error' });
    } finally {
      setVoiceUploadBusy(false);
    }
  };

  const handleConfirmAddVoice = () => {
    if (!newVoiceDraft) return;
    const trimmedName = newVoiceDraft.name.trim();
    if (!trimmedName) {
      showAlert('请填写音色样本名称', { type: 'warning' });
      return;
    }
    addVoiceToLibrary({ ...newVoiceDraft, name: trimmedName });
    setNewVoiceDraft(null);
    setShowAddModal(false);
  };

  const handleCancelAddVoice = () => {
    setNewVoiceDraft(null);
    setShowAddModal(false);
  };

  const handleUploadCharacterImage = (character: Character, file: File) =>
    uploadAssetImage(character, updateCharacterInLibrary, file);

  const handleUploadSceneImage = (scene: Scene, file: File) =>
    uploadAssetImage(scene, updateSceneInLibrary, file);

  const handleUploadPropImage = (prop: Prop, file: File) =>
    uploadAssetImage(prop, updatePropInLibrary, file);

  const handleSaveAsset = (asset: LibraryAsset) => {
    if (activeTab === 'character') {
      updateCharacterInLibrary(asset as Character);
      return;
    }
    if (activeTab === 'scene') {
      updateSceneInLibrary(asset as Scene);
      return;
    }
    updatePropInLibrary(asset as Prop);
  };

  const handleAddAsset = () => {
    if (activeTab === 'character') {
      if (!newCharacterForm.name.trim()) return;
      const nextCharacter: Character = {
        id: createId('char'),
        name: newCharacterForm.name.trim(),
        gender: newCharacterForm.gender.trim() || '未知',
        age: newCharacterForm.age.trim() || '未知',
        personality: newCharacterForm.personality.trim(),
        visualPrompt: '',
        coreFeatures: '',
        variations: [],
        version: 1,
      };
      addCharacterToLibrary(nextCharacter);
      setNewCharacterForm({ name: '', gender: '', age: '', personality: '' });
      setShowAddModal(false);
      return;
    }

    if (activeTab === 'scene') {
      if (!newSceneForm.location.trim()) return;
      const nextScene: Scene = {
        id: createId('scene'),
        location: newSceneForm.location.trim(),
        time: newSceneForm.time.trim() || '未知时间',
        atmosphere: newSceneForm.atmosphere.trim() || '常规',
        visualPrompt: '',
        version: 1,
      };
      addSceneToLibrary(nextScene);
      setNewSceneForm({ location: '', time: '', atmosphere: '' });
      setShowAddModal(false);
      return;
    }

    if (!newPropForm.name.trim()) return;
    const nextProp: Prop = {
      id: createId('prop'),
      name: newPropForm.name.trim(),
      category: newPropForm.category.trim() || '其他',
      description: newPropForm.description.trim(),
      visualPrompt: '',
      version: 1,
    };
    addPropToLibrary(nextProp);
    setNewPropForm({ name: '', category: '', description: '' });
    setShowAddModal(false);
  };

  const getCurrentCount = (): number => {
    if (activeTab === 'character') return filteredCharacters.length;
    if (activeTab === 'scene') return filteredScenes.length;
    if (activeTab === 'prop') return filteredProps.length;
    return filteredVoices.length;
  };

  const renderCharacterList = () => {
    if (filteredCharacters.length === 0) {
      return (
        <div className="border border-dashed border-[var(--border-primary)] p-12 text-center text-[var(--text-muted)]">
          <Users className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">{searchQuery ? '未找到匹配角色' : '角色库为空'}</p>
          <p className="text-[10px] font-mono">点击“添加角色”创建新角色，修改将自动同步到已引用的集。</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredCharacters.map((character) => (
          <AssetLibraryEditorCard
            key={character.id}
            type="character"
            asset={character}
            refCount={getCharacterRefCount(character.id)}
            onSave={handleSaveAsset}
            onDelete={() => handleDeleteCharacter(character)}
            onUploadImage={(file) => handleUploadCharacterImage(character, file)}
            onPreviewImage={setPreviewImage}
          />
        ))}
      </div>
    );
  };

  const renderSceneList = () => {
    if (filteredScenes.length === 0) {
      return (
        <div className="border border-dashed border-[var(--border-primary)] p-12 text-center text-[var(--text-muted)]">
          <MapPin className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">{searchQuery ? '未找到匹配场景' : '场景库为空'}</p>
          <p className="text-[10px] font-mono">点击“添加场景”创建新场景，修改将自动同步到已引用的集。</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredScenes.map((scene) => (
          <AssetLibraryEditorCard
            key={scene.id}
            type="scene"
            asset={scene}
            refCount={getSceneRefCount(scene.id)}
            onSave={handleSaveAsset}
            onDelete={() => handleDeleteScene(scene)}
            onUploadImage={(file) => handleUploadSceneImage(scene, file)}
            onPreviewImage={setPreviewImage}
          />
        ))}
      </div>
    );
  };

  const renderPropList = () => {
    if (filteredProps.length === 0) {
      return (
        <div className="border border-dashed border-[var(--border-primary)] p-12 text-center text-[var(--text-muted)]">
          <Package className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">{searchQuery ? '未找到匹配道具' : '道具库为空'}</p>
          <p className="text-[10px] font-mono">点击“添加道具”创建新道具，修改将自动同步到已引用的集。</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredProps.map((prop) => (
          <AssetLibraryEditorCard
            key={prop.id}
            type="prop"
            asset={prop}
            refCount={getPropRefCount(prop.id)}
            onSave={handleSaveAsset}
            onDelete={() => handleDeleteProp(prop)}
            onUploadImage={(file) => handleUploadPropImage(prop, file)}
            onPreviewImage={setPreviewImage}
          />
        ))}
      </div>
    );
  };

  const renderVoiceList = () => {
    if (filteredVoices.length === 0) {
      return (
        <div className="border border-dashed border-[var(--border-primary)] p-12 text-center text-[var(--text-muted)]">
          <Mic className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-2">{searchQuery ? '未找到匹配音色' : '音色库为空'}</p>
          <p className="text-[10px] font-mono">点击“添加音色样本”上传一段 mp3 / wav 录音，可用于 MiMo-V2.5-TTS-VoiceClone 等支持样本克隆的模型。</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredVoices.map((voice) => (
          <VoiceSampleCard
            key={voice.id}
            voice={voice}
            onSave={updateVoiceInLibrary}
            onDelete={() => handleDeleteVoice(voice)}
            onPublishToLibrary={() => handlePublishVoiceToLibrary(voice)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-secondary)] p-8 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
          <button
            onClick={() => navigate(`/project/${project.id}`)}
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-6 group"
          >
            <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
            返回项目概览
          </button>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-light text-[var(--text-primary)] tracking-tight flex items-center gap-3">
                <Users className="w-6 h-6 text-[var(--accent-text)]" />
                项目资产库
                <span className="text-[var(--text-muted)] text-sm font-mono uppercase tracking-widest">Project Library</span>
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">
                {project.title} · 角色 {characters.length} · 场景 {scenes.length} · 道具 {props.length} · 音色 {voices.length}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {activeTab !== 'voice' && (
                <button
                  onClick={handleImportFromAllEpisodes}
                  className="flex items-center gap-2 px-5 py-3 border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] transition-colors text-xs font-bold uppercase tracking-widest"
                  title="扫描本项目所有剧集，把未链接到项目库的角色/场景/道具按 name 去重后导入"
                >
                  <DownloadCloud className="w-4 h-4" />
                  从本项目剧集导入
                </button>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] transition-colors text-xs font-bold uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" />
                {activeTab === 'character'
                  ? '添加角色'
                  : activeTab === 'scene'
                    ? '添加场景'
                    : activeTab === 'prop'
                      ? '添加道具'
                      : '添加音色样本'}
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex border border-[var(--border-primary)]">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
                {tab.key === 'character' && ` (${characters.length})`}
                {tab.key === 'scene' && ` (${scenes.length})`}
                {tab.key === 'prop' && ` (${props.length})`}
                {tab.key === 'voice' && ` (${voices.length})`}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'character'
                  ? '搜索角色...'
                  : activeTab === 'scene'
                    ? '搜索场景...'
                    : activeTab === 'prop'
                      ? '搜索道具...'
                      : '搜索音色样本...'
              }
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-secondary)] rounded"
            />
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">{getCurrentCount()} items</div>
        </div>

        {activeTab === 'character' && renderCharacterList()}
        {activeTab === 'scene' && renderSceneList()}
        {activeTab === 'prop' && renderPropList()}
        {activeTab === 'voice' && renderVoiceList()}
      </div>

      {showAddModal && activeTab !== 'voice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/70 p-6" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border-primary)] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest mb-4">
              {activeTab === 'character' ? '添加角色到库' : activeTab === 'scene' ? '添加场景到库' : '添加道具到库'}
            </h3>

            {activeTab === 'character' && (
              <div className="space-y-3">
                <input
                  value={newCharacterForm.name}
                  onChange={(e) => setNewCharacterForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="角色名称 *"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-secondary)]"
                  autoFocus
                />
                <div className="flex gap-3">
                  <input
                    value={newCharacterForm.gender}
                    onChange={(e) => setNewCharacterForm((prev) => ({ ...prev, gender: e.target.value }))}
                    placeholder="性别"
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                  <input
                    value={newCharacterForm.age}
                    onChange={(e) => setNewCharacterForm((prev) => ({ ...prev, age: e.target.value }))}
                    placeholder="年龄"
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                </div>
                <textarea
                  value={newCharacterForm.personality}
                  onChange={(e) => setNewCharacterForm((prev) => ({ ...prev, personality: e.target.value }))}
                  placeholder="性格描述"
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
                />
              </div>
            )}

            {activeTab === 'scene' && (
              <div className="space-y-3">
                <input
                  value={newSceneForm.location}
                  onChange={(e) => setNewSceneForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="场景地点 *"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-secondary)]"
                  autoFocus
                />
                <div className="flex gap-3">
                  <input
                    value={newSceneForm.time}
                    onChange={(e) => setNewSceneForm((prev) => ({ ...prev, time: e.target.value }))}
                    placeholder="时间"
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                  <input
                    value={newSceneForm.atmosphere}
                    onChange={(e) => setNewSceneForm((prev) => ({ ...prev, atmosphere: e.target.value }))}
                    placeholder="氛围"
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'prop' && (
              <div className="space-y-3">
                <input
                  value={newPropForm.name}
                  onChange={(e) => setNewPropForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="道具名称 *"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-secondary)]"
                  autoFocus
                />
                <input
                  value={newPropForm.category}
                  onChange={(e) => setNewPropForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="道具分类"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
                <textarea
                  value={newPropForm.description}
                  onChange={(e) => setNewPropForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="道具描述"
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
                />
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddAsset}
                className="flex-1 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] text-xs font-bold uppercase tracking-widest hover:bg-[var(--btn-primary-hover)]"
              >
                添加
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 border border-[var(--border-primary)] text-[var(--text-tertiary)] text-xs font-bold uppercase tracking-widest hover:text-[var(--text-primary)]"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && activeTab === 'voice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/70 p-6" onClick={handleCancelAddVoice}>
          <div className="w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest mb-4">添加音色样本</h3>

            {!newVoiceDraft ? (
              <label className="block">
                <div className="border-2 border-dashed border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition-colors p-10 text-center cursor-pointer">
                  {voiceUploadBusy ? (
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)] animate-spin" />
                  ) : (
                    <UploadCloud className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)]" />
                  )}
                  <p className="text-sm text-[var(--text-secondary)] mb-1">
                    {voiceUploadBusy ? '正在读取音频...' : '点击选择 mp3 / wav 文件'}
                  </p>
                  <p className="text-[10px] font-mono text-[var(--text-muted)]">单个样本大小 ≤ 10MB（MiMo 上限）</p>
                </div>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave"
                  className="hidden"
                  disabled={voiceUploadBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    e.target.value = '';
                    void handlePickVoiceFile(file);
                  }}
                />
              </label>
            ) : (
              <div className="space-y-3">
                <audio src={newVoiceDraft.audioDataUrl} controls preload="metadata" className="w-full" />
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-[var(--text-muted)]">
                  <div>时长 {newVoiceDraft.durationSec ? `${newVoiceDraft.durationSec.toFixed(1)} 秒` : '--'}</div>
                  <div>大小 {(newVoiceDraft.sizeBytes / 1024 / 1024).toFixed(2)} MB</div>
                  <div>格式 {newVoiceDraft.mimeType.replace('audio/', '')}</div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">样本名称 *</label>
                  <input
                    value={newVoiceDraft.name}
                    onChange={(e) => setNewVoiceDraft({ ...newVoiceDraft, name: e.target.value })}
                    placeholder="如：温暖女声 - 王老师"
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-secondary)]"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">语言</label>
                    <input
                      value={newVoiceDraft.language || ''}
                      onChange={(e) => setNewVoiceDraft({ ...newVoiceDraft, language: e.target.value || undefined })}
                      placeholder="如：中文"
                      className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">样本台词（可选）</label>
                  <textarea
                    value={newVoiceDraft.transcript || ''}
                    onChange={(e) => setNewVoiceDraft({ ...newVoiceDraft, transcript: e.target.value || undefined })}
                    placeholder="样本里说了什么，用于辨识"
                    rows={2}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none resize-none"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleConfirmAddVoice}
                disabled={!newVoiceDraft || voiceUploadBusy}
                className="flex-1 py-2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] text-xs font-bold uppercase tracking-widest hover:bg-[var(--btn-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                添加到库
              </button>
              <button
                onClick={handleCancelAddVoice}
                className="flex-1 py-2 border border-[var(--border-primary)] text-[var(--text-tertiary)] text-xs font-bold uppercase tracking-widest hover:text-[var(--text-primary)]"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/90 p-6 cursor-pointer" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[90vh] object-contain" />
        </div>
      )}
    </div>
  );
};

export default CharacterLibraryPage;
