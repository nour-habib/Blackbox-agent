export type ActionEvent = {
  action_id: string;
  ts: string;
  command: string;
  cwd: string;
  source: string;
  decision: "allow" | "ask" | "deny";
  reason?: string;
  matched_rule?: string;
  confidence?: number;
  cache_hit?: boolean;
  executed: boolean;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
};

export type SessionRecord = {
  id: string;
  task: string;
  repoPath: string;
  branch: string;
  baseCommit: string;
  startedAt: string;
  status: "active" | "finished";
};

export type EvidenceBundle = {
  id: string;        // CLI field name
  sessionId?: string; // alias kept for backwards compatibility
  task: string;
  repoPath: string;
  branch: string;
  baseCommit: string;
  endCommit: string;
  startedAt: string;
  finishedAt: string;
  status: "finished";
  changedFiles: string[];
  diff: string;
  actions: ActionEvent[];
  agentTrace: string;
};

export type Claim = {
  id: string;
  kind: "observed" | "agent_reported" | "inferred";
  text: string;
  confidence: "low" | "medium" | "high";
  evidence: string[];
};

export type MemoryCard = {
  id: string;
  sessionId: string;
  type: "episodic" | "semantic" | "procedural" | "risk";
  claimType: "observed" | "agent_reported" | "inferred";
  content: string;
  evidence: string[];
  sourceFiles: string[];
  confidence: "low" | "medium" | "high";
  retrieveWhen: string[];
  staleIfChanged: string[];
  isStale: boolean;
  createdAt: string;
};

export type ContractAmendment = {
  id: string;
  sessionId: string;
  filePath: string;
  diff: string;
  reason: string;
  evidence: string[];
  status: "suggested" | "applied" | "rejected";
  createdAt: string;
};

export type DebugReport = {
  sessionId: string;
  summary: string;
  observedFacts: Claim[];
  agentReportedClaims: Claim[];
  inferredHypotheses: Claim[];
  failureModes: string[];
  memoryCards: MemoryCard[];
  recommendedContractAmendments: ContractAmendment[];
};

export type SessionFile = {
  evidenceBundle: EvidenceBundle;
  report: DebugReport;
};

export type ContextRequest = {
  task: string;
  limit?: number;
};

export type ContextResult = {
  task: string;
  memories: MemoryCard[];
  contextBlock: string;
};

export type ContractCheckInput = {
  command: string;
  sessionId?: string;
  cwd: string;
};
