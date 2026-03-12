export type ClassificationLevel =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

export interface DataClassification {
  level: ClassificationLevel;
  reason: string;
  canTrain: boolean;
  detectedKeywords?: string[];
}

/** Alias para compatibilidade */
export type Classification = DataClassification;

export interface PIIDetection {
  type: PIIType;
  position: number;
  length: number;
}

export type PIIType =
  | 'CPF'
  | 'CNPJ'
  | 'EMAIL'
  | 'PHONE'
  | 'CARD'
  | 'RG'
  | 'CEP'
  | 'CREDIT_CARD';

export interface FilteredMessage {
  content: string;
  originalHash: string;
  classification: DataClassification;
  piiDetected: boolean;
  piiTypes: PIIType[];
  workspaceId: string;
  userId: string;
  timestamp: string;
  eligibleForTraining: boolean;
}

export interface WorkspaceContext {
  workspaceId: string;
  tenantId: string;
  allowedCollections: string[];
  dataClassification: ClassificationLevel | string;
  retentionDays: number;
  userId?: string;
  autoAnonymize?: boolean;
  sensitiveKeywords?: string[];
}

/** Mapa de hierarquia para comparação de níveis */
export const CLASSIFICATION_HIERARCHY: Record<ClassificationLevel, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

export function meetsMinimumLevel(
  userLevel: ClassificationLevel,
  requiredLevel: ClassificationLevel
): boolean {
  return CLASSIFICATION_HIERARCHY[userLevel] >= CLASSIFICATION_HIERARCHY[requiredLevel];
}
