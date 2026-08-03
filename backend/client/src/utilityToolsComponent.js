import React, { useContext, useState, useCallback } from 'react';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

const UtilityToolsComponent = () => {
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const [fileForImport, setFileForImport] = useState(null);
    const [fileRowCount, setFileRowCount] = useState(0);
    const [isImporting, setIsImporting] = useState(false);

    const handleImportClick = async () => {
        if (!fileForImport) {
            setExecutionStatus("Status: No file selected for import.");
            return;
        }

        try {
            setIsImporting(true);
            setExecutionStatus('Status: Importing employee records...');
            const formData = new FormData();
            formData.append('file', fileForImport);

            const response = await fetch('/call-function-import-employees', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'Failed to import employees');
            }

            const result = await response.json();
            setExecutionStatus(
                `Status: Import complete ??${result.updated} updated, ${result.unchanged} unchanged, `
                + `${result.inserted} inserted, ${result.skipped} skipped (${result.processed} processed).`
            );
            setFileForImport(null);
            setFileRowCount(0);
            window.dispatchEvent(new CustomEvent('employees-imported'));
        } catch (error) {
            console.error('Error importing employees:', error);
            setExecutionStatus(`Status: Import failed ??${error.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    const onDrop = useCallback(async acceptedFiles => {
        const file = acceptedFiles[0];
        const csvText = await file.text();
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        if (parsed.errors.length > 0) {
            setFileForImport(null);
            setFileRowCount(0);
            setExecutionStatus(`Status: CSV could not be read ??${parsed.errors[0].message}`);
            return;
        }
        setFileForImport(file);
        setFileRowCount(parsed.data.length);
        setExecutionStatus(`Status: ${file.name} is ready (${parsed.data.length} employee records).`);
    }, []);

    const onDropRejected = useCallback(rejectedFiles => {
        console.log('Rejected files:', rejectedFiles);
        setFileForImport(null);
        setFileRowCount(0);
        setExecutionStatus("Status: No valid CSV file selected.");
    }, []);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        onDropRejected,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv'],
        },
        maxFiles: 1,
        noClick: true,
        noKeyboard: true
    });

    const exportEmployeesToCsv = (employees, fileName) => {
        const columnsToExclude = ['Name', 'Supervisor','username','password']; // Add any other column names you want to exclude
        const filteredEmployees = employees.map(employee => {
            // Create a new object with only the desired attributes
            return Object.keys(employee).reduce((acc, key) => {
                if (!columnsToExclude.includes(key)) {
                    acc[key] = employee[key];
                }
                return acc;
            }, {});
        });
        const csv = Papa.unparse(filteredEmployees);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, fileName);
        const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
        setExecutionStatus(`Status:${timeStamp}:\tExport succeeded!`);
    };

    const exportAllEmployeesToCsv = async () => {
        try {
            const response = await fetch('/employees');
            if (!response.ok) {
                throw new Error('Failed to load employees');
            }

            const allEmployees = await response.json();
            exportEmployeesToCsv(allEmployees, 'all-employees.csv');
        } catch (error) {
            console.error('Error exporting all employees:', error);
            setExecutionStatus(`Status: Export failed at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
        }
    };

    return (
        <div>
            <h3>Execution Status</h3>
            <p className="execution-status">{executionStatus}</p>
            <button onClick={() => exportEmployeesToCsv(selectedEmployees, 'selected-employees.csv')}>Export Selected Employees</button>
            <button onClick={exportAllEmployeesToCsv}>Export All Employees (Including Not Activated)</button>
            <div {...getRootProps()} style={{
                border: '2px dashed #007bff',
                borderRadius: '5px',
                padding: '20px',
                textAlign: 'center',
                marginTop: '20px',
            }}>
                <input {...getInputProps()} />
                {isDragActive ? <p>Drop the CSV file here ...</p> : <p>Drag and drop a CSV file here, or choose a file below.</p>}
                <button type="button" onClick={open}>Choose CSV File</button>
                {fileForImport && <p><strong>Selected:</strong> {fileForImport.name} ({fileRowCount} records)</p>}
            </div>
            <button onClick={handleImportClick} disabled={!fileForImport || isImporting}>
                {isImporting ? 'Importing Employees...' : 'Import Employees From CSV'}
            </button>
        </div>
    );
};

export default UtilityToolsComponent;

