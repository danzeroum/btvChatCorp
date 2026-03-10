export type AuthMethod = 'email' | 'google' | 'microsoft' | 'saml';

export interface OnboardingState {
  workspaceId: string;
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];

  workspace: {
    name?: string;
    subdomain?: string;
  };
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  auth: {
    method?: AuthMethod;
    domain?: string;
    autoProvision?: boolean;
  };
  project: {
    template?: string;
    name?: string;
    description?: string;
  };
  documents: {
    uploadedIds: string[];
    connectorConfigured?: string;
  };
  team: {
    invitedEmails: string[];
  };

  startedAt: string;
  completedAt?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  defaultInstructions: InstructionTemplate[];
  suggestedClassifications: string[];
  sampleQuestions: string[];
  recommendedSettings: {
    temperature: number;
    maxTokens: number;
    topK: number;
  };
}

export interface InstructionTemplate {
  title: string;
  content: string;
  triggerMode: 'always' | 'keyword';
  triggerKeywords?: string[];
  priority: number;
}
