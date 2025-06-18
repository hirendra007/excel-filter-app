import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ExcelService, ExcelFile, FilterResponse } from './services/excel.service';

@Component({
  selector: 'app-data-filter',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="filter-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Data Filter & Search</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <!-- File Selection -->
          <mat-form-field appearance="fill" class="full-width">
            <mat-label>Select Excel File</mat-label>
            <mat-select (selectionChange)="onFileSelect($event.value)">
              <mat-option *ngFor="let file of files" [value]="file">
                {{ file.fileName }} ({{ file.uploadDate | date }})
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Filters -->
          <div *ngIf="selectedFile" class="filters-section">
            <h3>Filters</h3>
            <form [formGroup]="filterForm" class="filter-form">
              <div class="filter-row">
                <mat-form-field *ngFor="let header of headers" appearance="fill">
                  <mat-label>{{ header }}</mat-label>
                  <input matInput [formControlName]="header" placeholder="Filter by {{ header }}">
                </mat-form-field>
              </div>
              <div class="filter-actions">
                <button mat-raised-button color="primary" (click)="onFilter()">Apply Filters</button>
                <button mat-raised-button (click)="clearFilters()">Clear All</button>
              </div>
            </form>
          </div>

          <!-- Data Table -->
          <div *ngIf="selectedFile" class="data-section">
            <div class="data-info">
              <p>Showing {{ filteredData.length }} of {{ totalRecords }} records</p>
            </div>

            <div *ngIf="loading" class="loading">
              <mat-spinner></mat-spinner>
            </div>

            <table mat-table [dataSource]="filteredData" class="data-table" *ngIf="!loading">
              <ng-container *ngFor="let header of headers" [matColumnDef]="header">
                <th mat-header-cell *matHeaderCellDef>{{ header }}</th>
                <td mat-cell *matCellDef="let row">{{ row[header] }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="headers"></tr>
              <tr mat-row *matRowDef="let row; columns: headers;"></tr>
            </table>

            <!-- Pagination -->
            <mat-paginator 
              [length]="totalRecords"
              [pageSize]="pageSize"
              [pageSizeOptions]="[5, 10, 25, 50]"
              (page)="onPageChange($event)"
              showFirstLastButtons
              *ngIf="!loading">
            </mat-paginator>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .filter-container { padding: 20px; }
    .full-width { width: 100%; margin-bottom: 20px; }
    .filters-section {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .filter-form { margin-top: 10px; }
    .filter-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }
    .filter-actions { display: flex; gap: 10px; }
    .data-section { margin-top: 20px; }
    .data-info { margin-bottom: 10px; font-weight: bold; }
    .data-table { width: 100%; margin-bottom: 20px; }
    .loading { display: flex; justify-content: center; padding: 20px; }
  `]
})
export class DataFilterComponent implements OnInit {
  files: ExcelFile[] = [];
  selectedFile: ExcelFile | null = null;
  filterForm: FormGroup;
  filteredData: any[] = [];
  headers: string[] = [];
  totalRecords = 0;
  currentPage = 1;
  pageSize = 10;
  totalPages = 0;
  loading = false;

  constructor(
    private excelService: ExcelService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.filterForm = this.fb.group({});
  }

  ngOnInit() {
    this.loadFiles();
  }

  loadFiles() {
    this.excelService.getFiles().subscribe({
      next: (files) => {
        this.files = files;
      },
      error: (error) => {
        this.snackBar.open('Failed to load files', 'Close', { duration: 3000 });
      }
    });
  }

  onFileSelect(file: ExcelFile) {
    this.selectedFile = file;
    this.headers = file.headers;
    this.buildFilterForm();
    this.loadData();
  }

  buildFilterForm() {
    const formControls: any = {};
    this.headers.forEach(header => {
      formControls[header] = [''];
    });
    this.filterForm = this.fb.group(formControls);
  }

  loadData() {
    if (!this.selectedFile) return;

    this.loading = true;
    const filters = this.filterForm.value;
    
    // Remove empty filters
    const cleanFilters: any = {};
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key].trim() !== '') {
        cleanFilters[key] = filters[key];
      }
    });

    this.excelService.filterData(this.selectedFile._id, cleanFilters, this.currentPage, this.pageSize)
      .subscribe({
        next: (response: FilterResponse) => {
          this.filteredData = response.data;
          this.totalRecords = response.totalRecords;
          this.totalPages = response.totalPages;
          this.loading = false;
        },
        error: (error) => {
          this.snackBar.open('Failed to load data', 'Close', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  onFilter() {
    this.currentPage = 1;
    this.loadData();
  }

  onPageChange(event: PageEvent) {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadData();
  }

  clearFilters() {
    this.filterForm.reset();
    this.onFilter();
  }
}