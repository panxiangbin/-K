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
import { installRemoteBackendWebSocket } from './remote-backend-bootstrap.js';
import { installNestedAudioBase } from './audio-base-bootstrap.js';
import { installJokerPairUiGuard } from './joker-pair-ui-guard.js';
import { installLandscapeMode } from './landscape-mode.js';
import { installGameLandscapeCleanV1 } from './game-landscape-clean-v1.js';
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
import './waiting-room-react-safe.css';
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
import './mobile-viewport-lock.css';
import './landscape-mode.css';
import './forced-landscape-lobby-r3.css';
import './game-landscape-clean-v1.css';
import './game-landscape-clean-v1-hotfix.css';
import './game-landscape-clean-v1-board-final.css';
import './game-wood-green-v1-geometry-fix.css';
import './game-wood-green-v1-structural-fix.css';
import './game-wood-green-v1-label-fit.css';
import './game-wood-green-v1-polish.css';

installRemoteBackendWebSocket();
installNestedAudioBase();
installLandscapeMode();
ReactDOM.createRoot(document.getElementById('root')).render(<><App /><RulesHelpLauncher /></>);

const disabledStartupEnhancers = new Set(
  new URLSearchParams(globalThis.location?.search || '')
    .get('disable-enhancers')
    ?.split(',')
    .map(name => name.trim())
    .filter(Boolean) || [],
);

function installStartupEnhancer(name, install) {
  if (disabledStartupEnhancers.has(name)) {
    console.info(`[startup:${name}] disabled for diagnostic`);
    return;
  }
  try {
    install();
  } catch (error) {
    console.error(`[startup:${name}]`, error);
  }
}

installStartupEnhancer('ink-theme-release', () => installInkThemeRelease());
installStartupEnhancer('game-table-header', () => installGameTableHeaderEnhancer());
installStartupEnhancer('hand-interaction', () => installHandInteractionEnhancer());
installStartupEnhancer('game-hand-controls', () => installGameHandControlsExperience());
installStartupEnhancer('game-action-guidance', () => installGameActionGuidance());
installStartupEnhancer('game-action-guard', () => installGameActionGuard());
installStartupEnhancer('game-action-feedback', () => installGameActionFeedback());
installStartupEnhancer('joker-pair-ui-guard', () => installJokerPairUiGuard());
installStartupEnhancer('ui-feedback-governor', () => installUiFeedbackGovernor());
installStartupEnhancer('lobby-entry-feedback', () => installLobbyEntryFeedback());
installStartupEnhancer('lobby-action-guidance', () => installLobbyActionGuidance());
installStartupEnhancer('waiting-room-experience', () => installWaitingRoomExperience());
installStartupEnhancer('waiting-room-request-lifecycle', () => installWaitingRoomRequestLifecycle());
installStartupEnhancer('game-table-foundation', () => installGameTableFoundation());
installStartupEnhancer('game-player-card-experience', () => installGamePlayerCardExperience());
installStartupEnhancer('game-trick-board-experience', () => installGameTrickBoardExperience());
installStartupEnhancer('settlement-experience', () => installSettlementExperience());
installStartupEnhancer('game-landscape-clean-v1', () => installGameLandscapeCleanV1());
