import fs from 'node:fs';
import path from 'node:path';

type Filter = {
  directories?: readonly string[];
  files?: readonly string[];
};

type RecursiveCopyOptions = {
  /** 是否处于"已命中 filter 的目录内部"，内部将全量复制 */
  directory?: boolean;
  /** 目标存在时是否覆盖；false 时静默跳过（不抛错） */
  overwrite?: boolean;
  filter?: Filter;
  /** 是否在开始前清空目标目录（仅顶层生效） */
  clear?: boolean;
};

/**
 * 复制 source 到 target。
 * filter 只作用于顶层：只有 directories 里的子目录会被递归进入，
 * 只有 files 里的文件会被复制；一旦进入命中目录，内部内容全量复制。
 */
export function copyFile(
  source: string,
  target: string,
  filter: Filter = {},
  clear: boolean = false,
) {
  recursiveCopy(source, target, { filter, clear });
}

function recursiveCopy(
  source: string,
  target: string,
  options: RecursiveCopyOptions = {},
) {
  const {
    directory = false,
    overwrite = true,
    filter = {},
    clear = false,
  } = options;
  const { directories = [], files = [] } = filter;

  const sourceInfo = fs.readdirSync(source, { withFileTypes: true });

  if (clear && fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  fs.mkdirSync(target, { recursive: true });

  for (const entry of sourceInfo) {
    const filename = entry.name;
    const sourcePath = path.join(source, filename);
    const targetPath = path.join(target, filename);

    if (entry.isDirectory() && directories.includes(filename)) {
      // 命中 filter 的目录：递归进入，内部不再过滤
      recursiveCopy(sourcePath, targetPath, {
        directory: true,
        overwrite,
        filter,
        // clear 只在顶层生效，递归时不传
      });
    } else if (files.includes(filename)) {
      // 命中 filter 的文件
      copyOne(sourcePath, targetPath, overwrite);
    } else if (directory) {
      // 已在命中目录内部：全量复制
      copyOne(sourcePath, targetPath, overwrite);
    }
  }
}

/**
 * 复制单个条目（文件或目录）。
 * overwrite=false 时，目标已存在则静默跳过，不抛错。
 */
function copyOne(sourcePath: string, targetPath: string, overwrite: boolean) {
  if (!overwrite && fs.existsSync(targetPath)) {
    return;
  }
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
  } else {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

export type { Filter };
