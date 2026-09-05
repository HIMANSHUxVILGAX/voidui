export interface ExplorerNode {
  id: string;
  name: string;
  isFolder: boolean;
  parentId: string | null;
}