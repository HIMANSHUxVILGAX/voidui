import type { TreeDataProvider, TreeItem, TreeItemIndex, Disposable } from "react-complex-tree";

export interface FsEntry {
    name: string;
    path: string;
    isFolder: boolean;
}

/**
 * A TreeDataProvider for react-complex-tree that loads a folder's contents
 * on demand (i.e. the first time that folder is expanded/rendered), instead
 * of requiring the whole tree to be built up-front like StaticTreeDataProvider does.
 *
 * This fixes two problems with the previous implementation:
 *  1. `read-directory` in the Electron main process only ever returns ONE
 *     level of entries, so a tree built once from that response could never
 *     show nested folders. This provider calls `readDirectory` again, per
 *     folder, exactly when that folder is expanded.
 *  2. Items were being flattened directly under "root" regardless of their
 *     real parent. Here every entry is stored under its own path and only
 *     attached as a child of the folder it actually came from.
 */
export class LazyFileTreeDataProvider implements TreeDataProvider<string> {
    private items: Map<TreeItemIndex, TreeItem<string>> = new Map();
    private listeners: ((changedItemIds: TreeItemIndex[]) => void)[] = [];
    private readDirectory: (path: string) => Promise<FsEntry[]>;

    constructor(rootPath: string, rootLabel: string, readDirectory: (path: string) => Promise<FsEntry[]>) {
        this.readDirectory = readDirectory;

        // "root" is a virtual node — its real filesystem path is rootPath.
        this.items.set("root", {
            index: "root",
            isFolder: true,
            // children left undefined on purpose: signals "not loaded yet"
            children: undefined,
            data: rootLabel,
        });

        // Stash the real path for the virtual root under a symbol-free key.
        this.rootPath = rootPath;
    }

    private rootPath: string;

    onDidChangeTreeData(listener: (changedItemIds: TreeItemIndex[]) => void): Disposable {
        this.listeners.push(listener);
        return {
            dispose: () => {
                this.listeners = this.listeners.filter((l) => l !== listener);
            },
        };
    }

    async getTreeItem(itemId: TreeItemIndex): Promise<TreeItem<string>> {
        const cached = this.items.get(itemId);

        // Files (and folders we've already loaded) are returned straight away.
        if (cached && cached.children !== undefined) {
            return cached;
        }

        // Folder whose children we haven't fetched yet — fetch now.
        const fsPath = itemId === "root" ? this.rootPath : (itemId as string);

        const entries = await this.readDirectory(fsPath);

        const childIds = entries.map((entry) => entry.path);

        entries.forEach((entry) => {
            // Don't clobber a folder we've already expanded/loaded before.
            if (!this.items.has(entry.path)) {
                this.items.set(entry.path, {
                    index: entry.path,
                    isFolder: entry.isFolder,
                    // Files have no children. Folders get `undefined` so they
                    // lazy-load the first time they're expanded.
                    children: entry.isFolder ? undefined : [],
                    data: entry.name,
                });
            }
        });

        const updated: TreeItem<string> = {
            ...(cached ?? { index: itemId, isFolder: true, data: String(itemId) }),
            children: childIds,
        };

        this.items.set(itemId, updated);

        return updated;
    }
}
