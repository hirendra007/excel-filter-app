import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { ExcelUploadComponent } from './excel-upload.component';
import { DataFilterComponent } from './data-filter.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    ExcelUploadComponent,
    DataFilterComponent
  ],
  template: `
    <div class="app-container">
      <mat-card class="header-card">
        <mat-card-header>
          <mat-card-title>Excel File Manager</mat-card-title>
          <mat-card-subtitle>Upload and filter Excel data with MongoDB storage</mat-card-subtitle>
        </mat-card-header>
      </mat-card>

      <mat-tab-group>
        <mat-tab label="Upload Excel">
          <app-excel-upload></app-excel-upload>
        </mat-tab>
        <mat-tab label="Filter & Search">
          <app-data-filter></app-data-filter>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .app-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .header-card {
      margin-bottom: 20px;
    }
  `]
})
export class App{
  title = 'Excel File Manager';
}