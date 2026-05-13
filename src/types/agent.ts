export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  model_class?: string;
  tools?: any[]; // Will type this later when implementing tool schema
}
