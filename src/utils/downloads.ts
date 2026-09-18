import { Platform } from 'obsidian';

type ElectronRemote = {
  app?: { getPath?: (name: string) => string };
  shell?: { showItemInFolder?: (fullPath: string) => void };
};

type PathModule = {
  join: (...parts: string[]) => string;
};

type FsPromisesModule = {
  access: (path: string) => Promise<void>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
};

/**
 * 按需加载 Node 模块，避免移动端启动时就引入 Node 依赖（与 ExportImagePlugin 保持一致）。
 */
function getNodePath(): PathModule {
  // eslint-disable-next-line import/no-nodejs-modules, @typescript-eslint/no-require-imports
  return require('path') as PathModule;
}

function getFsPromises(): FsPromisesModule {
  // eslint-disable-next-line import/no-nodejs-modules, @typescript-eslint/no-require-imports
  return require('fs/promises') as FsPromisesModule;
}

/**
 * 获取 Electron remote，插件只能通过它访问下载目录和系统文件管理器。
 */
function getElectronRemote(): ElectronRemote | undefined {
  return (window as Window & { electron?: { remote?: ElectronRemote } }).electron?.remote;
}

/**
 * 按 Chromium 的重名规则生成候选文件名，例如 report.png -> report (1).png。
 * 沿用同一套命名，用户不会因为落点从浏览器下载改为插件落盘而看到两种命名风格。
 */
function withCopyIndex(filename: string, index: number): string {
  if (index === 0) {
    return filename;
  }

  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const extension = dotIndex > 0 ? filename.slice(dotIndex) : '';
  return `${base} (${index})${extension}`;
}

/**
 * 在目标目录里找第一个不冲突的文件名，避免静默覆盖用户之前导出的同名文件。
 * @returns 可写入的绝对路径；目录不可用或重名过多时返回 undefined
 */
async function resolveAvailablePath(dir: string, filename: string): Promise<string | undefined> {
  const nodePath = getNodePath();
  const { access } = getFsPromises();

  for (let index = 0; index < 100; index++) {
    const candidate = nodePath.join(dir, withCopyIndex(filename, index));
    try {
      await access(candidate);
    } catch {
      // 文件不存在，说明该名字可用
      return candidate;
    }
  }

  return undefined;
}

/**
 * 桌面端把导出结果写入系统下载目录，并返回写入的绝对路径。
 * 原实现依赖 a[download] 交给 Electron 落盘，插件拿不到路径，导出后也就无法定位文件。
 * @param blob 导出内容
 * @param filename 目标文件名（不含目录）
 * @returns 写入成功时返回绝对路径；非桌面端或写入失败返回 undefined，由调用方回退
 */
export async function saveBlobToDownloads(blob: Blob, filename: string): Promise<string | undefined> {
  if (!Platform.isDesktop) {
    return undefined;
  }

  const downloadsDir = getElectronRemote()?.app?.getPath?.('downloads');
  if (!downloadsDir) {
    return undefined;
  }

  try {
    const filePath = await resolveAvailablePath(downloadsDir, filename);
    if (!filePath) {
      return undefined;
    }

    await getFsPromises().writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
    return filePath;
  } catch (error) {
    console.error('[NoteShareImageExporter] 写入下载目录失败，回退到浏览器下载：', error);
    return undefined;
  }
}

/**
 * 在系统文件管理器中定位导出文件：macOS 打开 Finder 并高亮，Windows 打开资源管理器并选中。
 * Electron 的 shell.showItemInFolder 已按平台选择实现，无需自己拼 open -R 或 explorer /select。
 * @param filePath 导出文件的绝对路径
 * @returns 无返回值；移动端或 Electron 不可用时静默跳过
 */
export function revealFileInFolder(filePath: string): void {
  if (!Platform.isDesktop) {
    return;
  }

  try {
    getElectronRemote()?.shell?.showItemInFolder?.(filePath);
  } catch (error) {
    console.error('[NoteShareImageExporter] 打开文件所在目录失败：', error);
  }
}
