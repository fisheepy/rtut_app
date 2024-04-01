import { SelectedEmployeesContext } from './selectedEmployeesContext';
import { useContext, useState } from 'react';
import axios from 'axios';

const UtilityToolsCompoent = () => {
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [executionStatus, setExecutionStatus] = useState('Status:');

    const exportEmployeesToCsv = async (selectedEmployees) => {
        const filteredEmployees = selectedEmployees.map(({ Name, Supervisor, ...keepAttrs }) => keepAttrs);

        try {
            axios({
                method: 'post',
                url: '/call-function-export-selected-employees',
                data: { employees: filteredEmployees },
                responseType: 'blob', // Important for handling binary data
            })
            .then(response => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'selected-employees.csv'); // Name the download file
                document.body.appendChild(link);
                link.click();
                link.parentNode.removeChild(link);
    
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tExport succeeded!`);
            })
            .catch(error => {
                console.error('Error downloading the file:', error);
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tExport failed!`);
            });
        } catch (error) {
            console.error('Error exporting employees to CSV:', error);
        }
    };
    
    const handleExportClick = () => {
        exportEmployeesToCsv(selectedEmployees);
    };

    return (
        <div>
        <h3>Execution Status</h3>
        <p className="execution-status">{executionStatus}</p>
        <button onClick={handleExportClick}>Export Selected Employees</button>
        </div>
    );
};

export default UtilityToolsCompoent;