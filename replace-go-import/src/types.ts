export interface ReplaceRule {
    name: string;
    from: string;
    to: string;
    exemptPaths: string[];
    enabled: boolean;
}

export interface PluginConfig {
    enabled: boolean;
    rules: ReplaceRule[];
    showNotifications: boolean;
}

export interface ReplacementResult {
    originalText: string;
    replacedText: string;
    ruleName: string;
    lineNumber: number;
    columnStart: number;
    columnEnd: number;
}

export interface ProcessResult {
    hasChanges: boolean;
    replacements: ReplacementResult[];
    error?: string;
}
