import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ExcelFile {
  _id: string;
  fileName: string;
  uploadDate: string;
  headers: string[];
}

export interface FilterResponse {
  data: any[];
  totalRecords: number;
  page: number;
  totalPages: number;
  headers: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  private baseUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) { }

  uploadFile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('excelFile', file);
    return this.http.post(`${this.baseUrl}/upload`, formData);
  }

  getFiles(): Observable<ExcelFile[]> {
    return this.http.get<ExcelFile[]>(`${this.baseUrl}/files`);
  }

  filterData(fileId: string, filters: any, page: number = 1, limit: number = 10): Observable<FilterResponse> {
    return this.http.post<FilterResponse>(`${this.baseUrl}/filter/${fileId}`, {
      filters,
      page,
      limit
    });
  }
}