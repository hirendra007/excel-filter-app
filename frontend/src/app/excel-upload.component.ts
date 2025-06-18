import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ExcelService } from './services/excel.service';

@Component({
  selector: 'app-excel-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <div class="upload-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Upload Excel File</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="file-input-container">
            <input type="file" 
                   (change)="onFileSelected($event)" 
                   accept=".xlsx,.xls" 
                   #fileInput>
            <button mat-raised-button color="primary" 
                    (click)="fileInput.click()" 
                    [disabled]="uploading">
              Choose File
            </button>
            <span *ngIf="selectedFile" class="file-name">{{ selectedFile.name }}</span>
          </div>
          <button mat-raised-button 
                  color="accent" 
                  (click)="onUpload()" 
                  [disabled]="!selectedFile || uploading"
                  class="upload-btn">
            <mat-icon *ngIf="uploading">hourglass_empty</mat-icon>
            {{ uploading ? 'Uploading...' : 'Upload File' }}
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .upload-container { padding: 20px; }
    .file-input-container {
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .file-input-container input[type="file"] { display: none; }
    .file-name { color: #666; font-style: italic; }
    .upload-btn { width: 100%; }
  `]
})
export class ExcelUploadComponent {
  selectedFile: File | null = null;
  uploading = false;

  constructor(
    private excelService: ExcelService,
    private snackBar: MatSnackBar
  ) {}

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  onUpload() {
    if (!this.selectedFile) {
      this.snackBar.open('Please select a file', 'Close', { duration: 3000 });
      return;
    }

    this.uploading = true;
    this.excelService.uploadFile(this.selectedFile).subscribe({
      next: (response) => {
        this.snackBar.open('File uploaded successfully!', 'Close', { duration: 3000 });
        this.selectedFile = null;
        this.uploading = false;
      },
      error: (error) => {
        this.snackBar.open('Upload failed: ' + error.error.error, 'Close', { duration: 5000 });
        this.uploading = false;
      }
    });
  }
}