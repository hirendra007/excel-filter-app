import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component'; // Changed from App to AppComponent
import { config } from './app/app.config.server';

const bootstrap = () => bootstrapApplication(AppComponent, config); // Changed from App to AppComponent

export default bootstrap;