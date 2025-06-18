import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ExcelRecord {
  _id?: string;
  [key: string]: any;
}

export interface ExcelFile {
  _id: string;
  fileName: string;
  uploadDate: Date;
  headers: string[];
}

export interface FilterResponse {
  data: any[];
  totalRecords: number;
  totalPages: number;
  currentPage: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  private apiUrl = 'http://localhost:3000/api'; // Change this to your backend URL

  constructor(private http: HttpClient) {}

  uploadExcel(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/upload`, formData);
  }

  uploadFile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.uploadExcel(formData);
  }

  getExcelData(): Observable<{ data: ExcelRecord[] }> {
    return this.http.get<{ data: ExcelRecord[] }>(`${this.apiUrl}/data`);
  }


  getFiles(): Observable<ExcelFile[]> {
    return this.http.get<ExcelFile[]>(`${this.apiUrl}/files`);
  }

  filterData(fileId: string, filters: any, page: number = 1, pageSize: number = 10): Observable<FilterResponse> {
    const params = {
      fileId,
      filters,
      page,
      pageSize
    };
    return this.http.post<FilterResponse>(`${this.apiUrl}/filter`, params);
  }

  searchData(searchTerm: string): Observable<ExcelRecord[]> {
    return this.http.get<ExcelRecord[]>(`${this.apiUrl}/search?term=${encodeURIComponent(searchTerm)}`);
  }

  deleteAllData(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/data`);
  }

  getColumns(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/columns`);
  }
}