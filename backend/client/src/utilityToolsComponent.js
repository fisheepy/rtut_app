import React, { useContext, useState, useCallback } from 'react';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import axios from 'axios';

const UtilityToolsComponent = () => {
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const [fileForImport, setFileForImport] = useState(null);

    const handleImportClick = async () => {
        if (!fileForImport) {
            setExecutionStatus("Status: No file selected for import.");
            return;
        }

        // Prepare form data for upload
        const formData = new FormData();
        formData.append('file', fileForImport);

        try {
            await axios.post('/call-function-import-employees', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
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
        const filteredEmployees = selectedEmployees.map(({ Name, Supervisor, ...keepAttrs }) => keepAttrs);
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