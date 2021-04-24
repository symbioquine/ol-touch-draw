import {Control} from 'ol/control';
import { CLASS_CONTROL, CLASS_UNSELECTABLE } from 'ol/css';


export default class ButtonControl extends Control {
  /**
   * @param {Object=} opt_options Control options.
   */
  constructor(opt_options) {
    const options = opt_options || {};

    const className = options.className || '';

    const button = document.createElement('button');
    button.innerHTML = options.label || '?';

    const element = document.createElement('div');
    element.className = `${className} ol-button-control ${CLASS_UNSELECTABLE} ${CLASS_CONTROL}`;
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener('click', this.handleClick_.bind(this), false);
  }

  handleClick_() {
    this.dispatchEvent('click');
  }
}
