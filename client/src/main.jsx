import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import RulesHelpLauncher from './components/RulesHelpLauncher';
import { installGameTableHeaderEnhancer } from './game-table-header';
import './index.css';
import './ui-responsive.css';
import './ui-polish.css';
import './waiting-room.css';
import './game-table-responsive.css';
import './game-table-header.css';
import './rules-help.css';

ReactDOM.createRoot(document.getElementById('root')).render(<><App /><RulesHelpLauncher /></>);
installGameTableHeaderEnhancer();
