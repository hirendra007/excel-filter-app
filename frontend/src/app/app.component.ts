import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExcelService } from './services/excel.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html', // Fixed path
  styleUrls: ['./app.component.css'] // Fixed path
})
export class AppComponent implements OnInit {
  title = 'Excel File Manager';
  selectedFile: File | null = null;
  excelData: any[] = [];
  filteredData: any[] = [];
  columns: string[] = [];
  filters: { [key: string]: string } = {};
  loading = false;
  uploadMessage = '';
  searchTerm = '';
  noRecordsMessage = '';

  constructor(private excelService: ExcelService) {}

  ngOnInit() {
    this.loadExcelData();
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
    this.uploadMessage = '';
  }

  uploadFile() {
    if (!this.selectedFile) {
      this.uploadMessage = 'Please select a file first';
      return;
    }

    this.loading = true;
    this.uploadMessage = '';

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.excelService.uploadExcel(formData).subscribe({
      next: (response) => {
        this.uploadMessage = 'File uploaded successfully!';
        this.loadExcelData();
        this.selectedFile = null;
        this.loading = false;
        // Reset file input
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      },
      error: (error) => {
        console.error('Upload error:', error);
        this.loading = false;
        
        // Display user-friendly error message
        if (error.status === 0) {
          this.uploadMessage = 'Error: Cannot connect to server. Please make sure the backend is running.';
        } else if (error.error && error.error.message) {
          this.uploadMessage = 'Error uploading file: ' + error.error.message;
        } else {
          this.uploadMessage = 'Error uploading file. Please try again.';
        }
      }
    });
  }

  loadExcelData() {
    this.loading = true;
    this.excelService.getExcelData().subscribe({
      next: (data) => {
        // Check if data is an array
        if (Array.isArray(data)) {
          this.excelData = data;
          this.filteredData = [...data];
          if (data.length > 0) {
            this.columns = Object.keys(data[0]).filter(key => key !== '_id' && key !== '__v');
            this.initializeFilters();
          }
        } else {
          console.error('API did not return an array:', data);
          this.excelData = [];
          this.filteredData = [];
          this.columns = [];
          this.uploadMessage = 'Error: Invalid response from server';
        }
        this.loading = false;
        this.updateNoRecordsMessage();
      },
      error: (error) => {
        console.error('Error loading data:', error);
        this.excelData = [];
        this.filteredData = [];
        this.columns = [];
        this.loading = false;
        
        // Display user-friendly error message
        if (error.status === 0) {
          this.uploadMessage = 'Error: Cannot connect to server. Please make sure the backend is running.';
        } else if (error.error && error.error.message) {
          this.uploadMessage = 'Error: ' + error.error.message;
        } else {
          this.uploadMessage = 'Error loading data. Please try again.';
        }
      }
    });
  }

  initializeFilters() {
    this.filters = {};
    this.columns.forEach(column => {
      this.filters[column] = '';
    });
  }

  onFilterChange(column: string, value: string) {
    this.filters[column] = value;
    this.applyFilters();
  }

  onSearchChange(value: string) {
    this.searchTerm = value;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredData = this.excelData.filter(row => {
      // Apply column filters
      const columnFilters = Object.keys(this.filters).every(column => {
        const filterValue = this.filters[column].toLowerCase().trim();
        if (!filterValue) return true;
        
        const cellValue = row[column] ? row[column].toString().toLowerCase() : '';
        return cellValue.includes(filterValue);
      });

      // Apply search term across all columns
      const searchMatch = !this.searchTerm || 
        this.columns.some(column => {
          const cellValue = row[column] ? row[column].toString().toLowerCase() : '';
          return cellValue.includes(this.searchTerm.toLowerCase());
        });

      return columnFilters && searchMatch;
    });
    
    this.updateNoRecordsMessage();
  }

  updateNoRecordsMessage() {
    if (this.filteredData.length === 0 && this.excelData.length > 0) {
      this.noRecordsMessage = 'No records matched your search criteria';
    } else {
      this.noRecordsMessage = '';
    }
  }

  clearFilters() {
    this.initializeFilters();
    this.searchTerm = '';
    this.filteredData = [...this.excelData];
    this.updateNoRecordsMessage();
  }

  deleteAllData() {
    if (confirm('Are you sure you want to delete all data?')) {
      this.excelService.deleteAllData().subscribe({
        next: () => {
          this.excelData = [];
          this.filteredData = [];
          this.columns = [];
          this.initializeFilters();
          this.uploadMessage = 'All data deleted successfully';
        },
        error: (error) => {
          console.error('Error deleting data:', error);
        }
      });
    }
  }
}