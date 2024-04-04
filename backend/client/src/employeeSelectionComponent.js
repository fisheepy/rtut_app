import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SelectedEmployeesContext } from './selectedEmployeesContext';

function EmployeeSelectionComponent() {
    const { selectedEmployees, setSelectedEmployees } = useContext(SelectedEmployeesContext);
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [filterValues, setFilterValues] = useState({});
    const [selectedFilters, setSelectedFilters] = useState({});
    const [startDate, setStartDate] = useState('1990-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [deselectedEmployees, setDeselectedEmployees] = useState(new Set());

    const columnsToDisplay = [
        'Name',
        'Hire Date',
        'Position Status',
        'Home Department',
        'Job Title',
        'Location',
        'Supervisor',
        'Phone',
        'Email',
    ];

    useEffect(() => {
        applyFilters();
    }, [selectedFilters, employees, deselectedEmployees, startDate, endDate]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const loginName = {firstName: 'Xuan', lastName: 'Yu'}; //localStorage.getItem('loginName');
                const response = await axios.get(`/employees?lastName=${loginName.lastName}&firstName=${loginName.firstName}`);
                console.log(response);
                const processedData = response.data.map(employee => ({
                    ...employee,
                    'Name': `${employee['Last Name']}, ${employee['First Name']}`, 
                    'Supervisor': `${employee['Supervisor Last Name']}, ${employee['Supervisor First Name']}` 
                }));
                const sortedData = processedData.sort((a, b) => {
                    return a['Last Name'].localeCompare(b['Last Name']);
                });
                setEmployees(sortedData);
                setFilteredEmployees(sortedData);
                extractFilterValues(sortedData);
                setSelectedEmployees(sortedData); // Assuming you want the initial selected employees to also be sorted
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
    };

    const extractFilterValues = (data) => {
        const values = {};
        if (data.length > 0) {
            for (const column of Object.keys(data[0])) {
                const uniqueValues = [...new Set(data.map((item) => item[column]))];
                values[column] = uniqueValues;
            }
            setFilterValues(values);
        }
    };

    const handleFilterChange = (event, columnName) => {
        const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
        if (selectedOptions.includes("all")) {
            const { [columnName]: removed, ...rest } = selectedFilters;
            setSelectedFilters(rest);
        } else {
            setSelectedFilters(prevFilters => ({
                ...prevFilters,
                [columnName]: selectedOptions
            }));
        }
        applyFilters();
    };

    const applyFilters = () => {
        // Separate filter for Payroll Name to treat it specially
        const payrollNameFilter = selectedFilters['Name'];

        // Default start and end dates
        const defaultStartDate = new Date('1995/01/01');
        const defaultEndDate = new Date(); // Today

        // Parse the input start and end dates, fallback to default if not specified
        const start = startDate ? new Date(startDate) : defaultStartDate;
        const end = endDate ? new Date(endDate) : defaultEndDate;

        // Filter by payroll name if specified
        const filteredByPayrollName = payrollNameFilter && payrollNameFilter.length > 0
            ? employees.filter(employee => payrollNameFilter.includes(employee['Name']))
            : [];

        // Filter by other criteria except for Payroll Name, including date range
        const filteredByOtherCriteria = employees.filter(employee => {
            // Convert employee's hire/rehire date from string to Date object
            const hireDate = new Date(employee['Hire Date']);

            // Check if employee's date falls within the specified range
            const isInDateRange = hireDate >= start && hireDate <= end;

            // Check other filters excluding Payroll Name
            const matchesOtherFilters = Object.entries(selectedFilters).every(([columnName, filterValues]) =>
                columnName === 'Name' || // Skip Payroll Name in this filtering step
                filterValues.length === 0 || filterValues.includes(employee[columnName])
            );

            return isInDateRange && matchesOtherFilters;
        });

        // Combine the two filtered arrays, ensuring unique entries
        const combinedFilteredEmployees = [
            ...filteredByPayrollName,
            ...filteredByOtherCriteria.filter(employee =>
                !filteredByPayrollName.some(filteredEmployee => filteredEmployee['Name'] === employee['Name'])
            )
        ];
        const finalFilteredEmployees = combinedFilteredEmployees.filter(employee =>
            !deselectedEmployees.has(employee._id) // Assuming each employee has a unique 'id' property
        );

        setFilteredEmployees(combinedFilteredEmployees);
        setSelectedEmployees(finalFilteredEmployees);
        console.log(finalFilteredEmployees);
        console.log(filteredEmployees);
    };

    const handleDeselectCheckboxChange = (employeeId, isSelected) => {
        setDeselectedEmployees(prevDeselectedEmployees => {
            const updatedDeselectedEmployees = new Set(prevDeselectedEmployees);
            console.log(employeeId);
            console.log(isSelected);
            if (!isSelected) {
                updatedDeselectedEmployees.add(employeeId);
            } else {
                updatedDeselectedEmployees.delete(employeeId);
            }

            // Immediately apply filters with the updated set of deselected employees
            applyFilters(updatedDeselectedEmployees);
            return updatedDeselectedEmployees;
        });
    };

    return (
        <div>
            <h3>Selected Employees</h3>
            {employees.length > 0 ? (
                <div className="grid-container">
                    <tr>
                        <label>
                            Start Date:
                            <input type="date" value={startDate} onChange={handleStartDateChange} />
                        </label>
                        <label>
                            End Date:
                            <input type="date" value={endDate} onChange={handleEndDateChange} />
                        </label>
                    </tr>
                    <table>
                        <thead>
                            <tr>
                                <th>Select</th> {/* New column for checkboxes */}
                                {columnsToDisplay.map((columnName, index) => {
                                    if (columnName === "Hire Date") {
                                        // Skip rendering a filter for "Hire/Rehire Date"
                                        return (
                                            <th key={index}>{columnName}</th>
                                        );
                                    } else {
                                        return (
                                            <th key={index}>
                                                {columnName}
                                                <div className="filter-item">
                                                    <select
                                                        multiple
                                                        value={selectedFilters[columnName] || []}
                                                        onChange={(event) => handleFilterChange(event, columnName)}
                                                    >
                                                        <option value="all">All</option>
                                                        {filterValues[columnName] && filterValues[columnName].map((value, index) => (
                                                            <option key={index} value={value}>{value}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </th>
                                        );
                                    }
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map((employee, index) => (
                                <tr key={index} style={{ textDecoration: deselectedEmployees.has(employee._id) ? 'line-through' : 'none' }}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={!deselectedEmployees.has(employee._id)}
                                            onChange={e => handleDeselectCheckboxChange(employee._id, e.target.checked)}
                                        />
                                    </td>
                                    {columnsToDisplay.map((column, colIndex) => (
                                        <td key={colIndex}>{employee[column]}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p>No data available</p>
            )}
        </div>
    );
}

export default EmployeeSelectionComponent;
