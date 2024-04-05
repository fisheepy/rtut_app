import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableContainer, 
    TableHead, 
    TableRow, 
    Checkbox, 
    Paper, 
    TextField, 
    MenuItem, 
    FormGroup 
} from '@mui/material';

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
                const loginName = { firstName: 'Xuan', lastName: 'Yu' }; //localStorage.getItem('loginName');
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
        const value = event.target.value;
        setSelectedFilters(prevFilters => {
            // If "All" is selected (represented as an empty string), remove the filter from the selectedFilters object
            if (value === "") {
                const newFilters = { ...prevFilters };
                delete newFilters[columnName];
                return newFilters;
            } else {
                // Otherwise, update the filter as usual
                return {
                    ...prevFilters,
                    [columnName]: value,
                };
            }
        });
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

    const handleCheckboxChange = (employeeId) => {
        setDeselectedEmployees(prev => {
            const newSet = new Set(prev);
            if (newSet.has(employeeId)) {
                newSet.delete(employeeId);
            } else {
                newSet.add(employeeId);
            }
            return newSet;
        });
    };

    const columns = [
        { id: 'Name', label: 'Name', filter: true },
        { id: 'Hire Date', label: 'Hire Date', filter: false },
        { id: 'Position Status', label: 'Position Status', filter: true },
        { id: 'Home Department', label: 'Home Department', filter: true },
        { id: 'Location', label: 'Location', filter: false },
        { id: 'Supervisor', label: 'Supervisor', filter: false },
        { id: 'Phone', label: 'Location', filter: false },
        { id: 'Email', label: 'Email', filter: false },

        // Add other columns as needed...
    ];

    return (
        <div>
            <h3>Selected Employees</h3>
            <TableContainer component={Paper}>
                <Table aria-label="employee selection table">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell key={column.id}>{column.label}</TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell key={column.id + '-filter'}>
                                    {column.filter ? (
                                        <TextField
                                            select
                                            fullWidth
                                            label={column.label}
                                            value={selectedFilters[column.id] || ''}
                                            onChange={(e) => handleFilterChange(e, column.id)}
                                            size="small"
                                        >
                                            <MenuItem key="all" value="">
                                                All
                                            </MenuItem>
                                            {filterValues[column.id]?.map((option) => (
                                                <MenuItem key={option} value={option}>
                                                    {option}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    ) : null}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredEmployees.map((employee) => (
                            <TableRow key={employee._id} style={{ textDecoration: deselectedEmployees.has(employee._id) ? 'line-through' : 'none' }}>
                                {columns.map((column, colIndex) => (
                                    <TableCell key={colIndex}>
                                        {column.id === 'select' ? (
                                            <Checkbox
                                                checked={!deselectedEmployees.has(employee._id)}
                                                onChange={() => handleCheckboxChange(employee._id)}
                                                color="primary"
                                            />
                                        ) : (
                                            employee[column.id]
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}

export default EmployeeSelectionComponent;
