

export type NotificationData = {
    type: 'success' | 'error' | 'info';
    title: string;
    message?: string;
};

export function Notification({ data }: { data: NotificationData }) {
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    return (
        <div className={`toast ${data.type}`}>
            <span className="text-base font-bold">{icons[data.type]}</span>
            <div>
                <div className="font-semibold">{data.title}</div>
                {data.message && <div className="opacity-80 text-xs mt-0.5">{data.message}</div>}
            </div>
        </div>
    );
}
