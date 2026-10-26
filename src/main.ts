import './styles.css';
import { App } from './App';

const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('BAGUETTE RUN could not find its paper stage.');
}

new App(canvas);
