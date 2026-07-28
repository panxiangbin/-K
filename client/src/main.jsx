import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import RulesHelpLauncher from './components/RulesHelpLauncher';
import { installGameTableHeaderEnhancer } from './game-table-header';
import { installHandInteractionEnhancer } from './hand-interaction-enhancer';
import { installGameHandControlsExperience } from './game-hand-controls-experience.js';
import { installGameActionGuidance } from './game-action-guidance.js';
import { installGameActionGuard } from './game-action-guard';
import { installGameActionFeedback } from './game-action-feedback';
import { installUiFeedbackGovernor } from './ui-feedback-governor.js';
import { installLobbyEntryFeedback } from './lobby-entry-feedback.js';
import { installLobbyActionGuidance } from './lobby-action-guidance.js';
import { installWaitingRoomExperience } from './waiting-room-experience.js';
import { installWaitingRoomRequestLifecycle } from './waiting-room-request-lifecycle.js';
import { installGameTableFoundation } from './game-table-foundation.js';
import { installGamePlayerCardExperience } from './game-player-card-experience.js';
import { installGameTrickBoardExperience } from './game-trick-board-experience.js';
import { installSettlementExperience } from './settlement-experience.js';
import { installInkThemeRelease } from './ink-theme-release.js';
import './index.css';
import './ui-responsive.css';
import './ui-polish.css';
import './waiting-room.css';
import './game-table-responsive.css';
import './game-table-header.css';
import './hand-interaction.css';
import './game-hand-controls-experience.css';
import './game-action-guidance.css';
import './game-action-feedback.css';
import './rules-help.css';
import './compact-game-controls.css';
import './ui-design-system.css';
import './ui-feedback-governor.css';
import './global-audio-controls.css';
import './lobby-entry.css';
import './lobby-entry-feedback.css';
import './lobby-action-guidance.css';
import './waiting-room-experience.css';
import './waiting-room-request-lifecycle.css';
import './game-table-foundation.css';
import './game-player-card-experience.css';
import './game-trick-board-experience.css';
import './settlement-experience.css';
import './ink-theme.css';
import './ink-theme-release.css';
import './mobile-operability.css';
import './mobile-scroll-hotfix.css';
import './mobile-game-overlay.css';
import './mobile-game-layout-r4.css';
import './mobile-game-layout-r4-structure.css';

ReactDOM.createRoot(document.getElementById('root')).render(<><App /><RulesHelpLauncher /></>);

const startupEnhancers = [
  ['ink-theme-release', installInkThemeRelease],
  ['game-table-header', installGameTableHeaderEnhancer],
  ['hand-interaction', installHandInteractionEnhancer],
  ['game-hand-controls', installGameHandControlsExperience],
  ['game-action-guidance', installGameActionGuidance],
  ['game-action-guard', installGameActionGuard],
  ['game-action-feedback', installGameActionFeedback],
  ['ui-feedback-governor', installUiFeedbackGovernor],
  ['lobby-entry-feedback', installLobbyEntryFeedback],
  ['lobby-action-guidance', installLobbyActionGuidance],
  ['waiting-room-experience', installWaitingRoomExperience],
  ['waiting-room-request-lifecycle', installWaitingRoomRequestLifecycle],
  ['game-table-foundation', installGameTableFoundation],
  ['game-player-card-experience', installGamePlayerCardExperience],
  ['game-trick-board-experience', installGameTrickBoardExperience],
  ['settlement-experience', installSettlementExperience],
];

for (const [name, install] of startupEnhancers) {
  try {
    install();
  } catch (error) {
    console.error(`[startup:${name}]`, error);
  }
}
