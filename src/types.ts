export type VaultEntry = {
    id: string;
    name: string;
    path: string;
    status: 'protected' | 'unlocked';
    size: number;
    timestamp: Date;
};
