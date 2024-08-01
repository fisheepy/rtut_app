import React, { useContext, useState, useCallback } from 'react';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

const UtilityToolsComponent = () => {
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const [fileForImport, setFileForImport] = useState(null);

    const handleImportClick = async () => {
        if (!fileForImport) {
            setExecutionStatus("Status: No file selected for import.");
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', fileForImport);

            const response = await fetch('/call-function-import-employees', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to import employees');
            }

            setExecutionStatus(`Status: Import succeeded at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
            setFileForImport(null);
        } catch (error) {
            console.error('Error importing employees:', error);
            setExecutionStatus(`Status: Import failed at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
        }
    };

    const onDrop = useCallback(acceptedFiles => {
        setFileForImport(acceptedFiles[0]);
        setExecutionStatus("Status: File ready for import.");
    }, []);

    const onDropRejected = useCallback(rejectedFiles => {
        console.log('Rejected files:', rejectedFiles);
        setExecutionStatus("Status: No valid CSV file selected.");
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected,
        accept: 'text/csv, application/vnd.ms-excel, .csv',
        maxFiles: 1,
        noClick: true,
        noKeyboard: true
    });

    const exportEmployeesToCsv = (selectedEmployees) => {
        const columnsToExclude = ['Name', 'Supervisor','username','password']; // Add any other column names you want to exclude
        const filteredEmployees = selectedEmployees.map(employee => {
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
        saveAs(blob, 'selected-employees.csv');
        const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
        setExecutionStatus(`Status:${timeStamp}:\tExport succeeded!`);
    };

    return (
        <div>
            <h3>Execution Status</h3>
            <p className="execution-status">{executionStatus}</p>
            <button onClick={() => exportEmployeesToCsv(selectedEmployees)}>Export Selected Employees</button>
            <div {...getRootProps()} style={{
                border: '2px dashed #007bff',
                borderRadius: '5px',
                padding: '20px',
                textAlign: 'center',
                marginTop: '20px',
            }}>
                <input {...getInputProps()} />
                {isDragActive ? <p>Drop the CSV file here ...</p> : <p>Drag 'n' drop a CSV file here</p>}
            </div>
            <button onClick={handleImportClick}>Import Employees From CSV</button>
        </div>
    );
};

export default UtilityToolsComponent;