import { useMemo, useState } from "react";

import { UncontrolledTreeEnvironment, Tree, TreeItem } from "react-complex-tree";

import "react-complex-tree/lib/style-modern.css";
import "./Explorer.css";

import { LazyFileTreeDataProvider } from "./LazyFileTreeDataProvider";
import { getFileType, FileTypeInfo } from "../../../utils/fileType";

/** What gets handed off to whatever consumes an opened file (e.g. the editor). */
export interface OpenedFile {
    path: string;
    name: string;
    size: number;
    /** utf-8 text content — only meaningful when fileType.category === "text" */
    content: string;
    /** base64 content — use this for images/binary instead of `content` */
    base64: string;
    fileType: FileTypeInfo;
}

interface ExplorerProps {
    /** Called with the full payload whenever a FILE (not a folder) is clicked. */
    onFileOpen?: (file: OpenedFile) => void;
}

export default function Explorer({ onFileOpen }: ExplorerProps) {
    const [workspace, setWorkspace] = useState<string | null>(null);

    const dataProvider = useMemo(() => {
        if (!workspace) return null;

        return new LazyFileTreeDataProvider(workspace, "Workspace", (path) =>
            window.api.readDirectory(path)
        );
    }, [workspace]);

    const openFolder = async () => {
        const folder = await window.api.selectDirectory();
        if (!folder) return;
        setWorkspace(folder);
    };

    /**
     * This is the function you asked for: given whatever tree item was
     * clicked, work out folder vs file, and — if it's a file — read its
     * content and hand a complete payload to `onFileOpen`.
     */
    const handleItemClick = async (item: TreeItem<string>) => {
        console.log('clicked item:', item.index, 'isFolder:', item.isFolder);
        if (item.isFolder) return;          // ← the folder/file check

        const path = item.index as string;
        const fileType = getFileType(path);

        if (fileType.category === 'binary') {
            onFileOpen?.({ path, name: item.data, size: 0, content: '[Binary file - preview not available]', base64: '', fileType })
            return
        }

        console.log("Reading file:", path);

        try {
            const result = await window.api.readFile(path);

            console.log("readFile returned:", result);

            const { size, content, base64 } = result;

            console.log("Calling onFileOpen");

            onFileOpen?.({
                path,
                name: item.data,
                size,
                content,
                base64,
                fileType
            });

            console.log("onFileOpen finished");
        } catch (err) {
            console.error('[Explorer] Failed to read file:', err)
        }
    };

    const viewState = useMemo(
        () => ({
            "tree-1": {
                expandedItems: ["root"],
                focusedItem: "root",
            },
        }),
        [workspace]
    );

    return (
        <div className="explorer-panel">
            <button onClick={openFolder}>Open Folder</button>

            {!dataProvider && (
                <div style={{ color: "white", opacity: 0.6, padding: "8px" }}>
                    No folder open yet.
                </div>
            )}

            {dataProvider && (
                <UncontrolledTreeEnvironment
                    dataProvider={dataProvider}
                    getItemTitle={(item) => item.data}
                    viewState={viewState}
                    onPrimaryAction={(item) => {
                        void handleItemClick(item);
                    }}
                >
                    <Tree treeId="tree-1" rootItem="root" treeLabel="Explorer" />
                </UncontrolledTreeEnvironment>
            )}
        </div>
    );
}