import uiStyles from './ui.module.css';

type AgentStatus = 'active' | 'idle' | 'error' | 'offline';

interface AgentStatusDotProps {
  status: AgentStatus;
  className?: string;
}

export function AgentStatusDot({ status, className }: AgentStatusDotProps) {
  const modifier =
    status === 'active' ? uiStyles.statusActive :
    status === 'idle'   ? uiStyles.statusIdle   :
    status === 'error'  ? uiStyles.statusError  :
    uiStyles.statusOffline;

  return (
    <div className={`${uiStyles.statusDot} ${modifier}${className ? ` ${className}` : ''}`} />
  );
}
