import { useI18n } from '../i18n';
import { useState } from 'react';

export function Settings() {
    const { lang, setLang, t } = useI18n();
    const [memProfile, setMemProfile] = useState(() => localStorage.getItem('nx_memProfile') || '256');

    const updateMemProfile = (val: string) => {
        setMemProfile(val);
        localStorage.setItem('nx_memProfile', val);
    };

    return (
        <div className="flex flex-col gap-4 animate-slide-up">
            <div>
                <h2 className="text-xl font-bold text-nx-text flex items-center gap-2">
                    <span>⚙️</span> {t.set_title}
                </h2>
                <p className="text-sm text-nx-muted mt-1">{t.set_subtitle}</p>
            </div>

            <div className="glass p-4 space-y-4">
                {/* Language section */}
                <div className="flex items-center justify-between pb-4 border-b border-nx-border/50">
                    <div>
                        <p className="text-sm font-semibold text-nx-text">{t.set_lang_title}</p>
                        <p className="text-xs text-nx-muted">{t.set_lang_desc}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-nx-surface p-1 rounded-lg border border-nx-border">
                        <button
                            onClick={() => setLang('en')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${lang === 'en' ? 'bg-nx-cyan text-nx-bg' : 'text-nx-muted hover:text-nx-text'
                                }`}
                        >
                            {t.set_lang_en}
                        </button>
                        <button
                            onClick={() => setLang('it')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${lang === 'it' ? 'bg-nx-cyan text-nx-bg' : 'text-nx-muted hover:text-nx-text'
                                }`}
                        >
                            {t.set_lang_it}
                        </button>
                    </div>
                </div>

                {/* Argon2 Profile section */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-nx-text">{t.set_profile_title}</p>
                        <p className="text-xs text-nx-muted">{t.set_profile_desc}</p>
                    </div>
                    <select
                        value={memProfile}
                        onChange={(e) => updateMemProfile(e.target.value)}
                        className="bg-nx-surface border border-nx-border text-nx-text text-xs rounded-lg px-3 py-2 outline-none cursor-pointer hover:border-nx-cyan/50 transition-colors"
                    >
                        <option value="64">{t.set_profile_low}</option>
                        <option value="128">{t.set_profile_std}</option>
                        <option value="256">{t.set_profile_high}</option>
                    </select>
                </div>
            </div>

            {/* Tech Info Table */}
            <div className="glass p-4 space-y-4">
                <div className="border-b border-nx-border/50 pb-2">
                    <h3 className="text-sm font-semibold text-nx-text">{t.set_info_title}</h3>
                    <p className="text-xs text-nx-muted">{t.set_info_desc}</p>
                </div>
                <div className="overflow-hidden rounded-lg border border-nx-border/50">
                    <table className="w-full text-left text-xs text-nx-text">
                        <tbody className="divide-y divide-nx-border/50">
                            <tr className="bg-nx-surface/30">
                                <th className="px-4 py-2 font-medium text-nx-muted border-r border-nx-border/50">{t.set_info_algo_title}</th>
                                <td className="px-4 py-2 font-mono text-[10px] md:text-xs">XChaCha20-Poly1305</td>
                            </tr>
                            <tr>
                                <th className="px-4 py-2 font-medium text-nx-muted border-r border-nx-border/50">{t.set_info_kdf_title}</th>
                                <td className="px-4 py-2 font-mono text-[10px] md:text-xs">Argon2id</td>
                            </tr>
                            <tr className="bg-nx-surface/30">
                                <th className="px-4 py-2 font-medium text-nx-muted border-r border-nx-border/50">{t.set_info_hash_title}</th>
                                <td className="px-4 py-2 font-mono text-[10px] md:text-xs">BLAKE3</td>
                            </tr>
                            <tr>
                                <th className="px-4 py-2 font-medium text-nx-muted border-r border-nx-border/50">{t.set_info_arch_title}</th>
                                <td className="px-4 py-2 font-mono text-[10px] md:text-xs">Tauri v2 + Rust</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
