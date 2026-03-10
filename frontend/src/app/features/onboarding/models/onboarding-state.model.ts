export interface OnboardingState {
  workspaceId?: string;
  currentStep: number;
  completedSteps: number[];

  workspace?: {
    workspaceName?: string;
    subdomain?: string;
    adminName?: string;
    adminEmail?: string;
    adminPassword?: string;
  };

  branding?: {
    displayName?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };

  auth?: {
    method?: string;
    domain?: string;
    autoProvision?: boolean;
  };

  project?: {
    templateId?: string;
    projectName?: string;
    description?: string;
  };

  documents?: {
    uploadedIds: string[];
    connectorConfigured?: string;
  };

  team?: {
    invitedEmails: string[];
    sendWelcomeEmail?: boolean;
  };
}
