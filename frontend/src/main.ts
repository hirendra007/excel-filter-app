import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component'; // Changed from App to AppComponent
import { appConfig } from './app/app.config';
import { withFetch, provideHttpClient } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(withFetch())],
});