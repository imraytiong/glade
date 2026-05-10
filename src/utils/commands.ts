export interface Command {
  id: string;
  name: string;
  action: () => void;
  // If true, the command requires a visual component (like settings input)
  // For now we just implement direct actions, but we can set this flag.
  requiresInput?: boolean; 
}
