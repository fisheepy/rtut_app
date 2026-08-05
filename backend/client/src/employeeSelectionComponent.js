import React, { useState, useEffect, useContext, useRef } from 'react';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
    Autocomplete,
    Alert,
    Box,
    Chip,
    Collapse,
    Stack,
    Typography,
    FormControlLabel,
} from '@mui/material';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { canonicalizeEmployeeFilters } from './employeeFilterUtils';

const parseEmployeeDate = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) return { year: isoMatch[1], month: isoMatch[2], day: isoMatch[3] };
    const usMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
    if (usMatch) return {
        year: usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3],
        month: usMatch[1],
        day: usMatch[2],
    };
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
        year: String(parsed.getUTCFullYear()),
        month: String(parsed.getUTCMonth() + 1),
        day: String(parsed.getUTCDate()),
    };
};

const formatEmployeeDate = (value) => {
    const parsed = parseEmployeeDate(value);
    if (!parsed) return value || '';
    return `${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}/${parsed.year}`;
};

const employeeDateInputValue = (value) => {
    const parsed = parseEmployeeDate(value);
    if (!parsed) return '';
    return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
};

const editableEmployeeFields = [
    'First Name', 'Last Name', 'Hire Date', 'Home Department', 'Supervisor First Name',
    'Supervisor Last Name', 'Job Title', 'Location', 'Email', 'Phone',
    'EEOC Establishment', 'Worker Category', 'Pay Category',
];

function EmployeeSelectionComponent() {
    const { selectedEmployees, setSelectedEmployees } = useContext(SelectedEmployeesContext);
    const tableContainerRef = useRef(null);
    const topScrollRef = useRef(null);
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [filterValues, setFilterValues] = useState({});
    const [selectedFilters, setSelectedFilters] = useState({ isActivated: [true] });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [deselectedEmployees, setDeselectedEmployees] = useState(new Set());
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [originalEmployee, setOriginalEmployee] = useState(null);
    const [changeDetails, setChangeDetails] = useState({ effectiveDate: '', reason: '', payroll: false, insurance: false, retirement: false, trackOther: false });
    const [editError, setEditError] = useState('');
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [showMoreFilters, setShowMoreFilters] = useState(false);

    useEffect(() => {
        applyFilters();
    }, [selectedFilters, employees, deselectedEmployees, startDate, endDate, employeeSearch]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('/employees');
                const processedData = response.data.map(employee => ({
                    ...employee,
                    'Name': [employee['Last Name'], employee['First Name']].filter(Boolean).join(', '),
                    'Supervisor': [employee['Supervisor Last Name'], employee['Supervisor First Name']].filter(Boolean).join(', '),
                    isActivated: employee.isActivated === true || String(employee.isActivated).toLowerCase() === 'true',
                }));
                const sortedData = canonicalizeEmployeeFilters(processedData)
                    .sort((a, b) => a['Last Name'].localeCompare(b['Last Name']));
                const activatedEmployees = sortedData.filter(employee => employee.isActivated === true);
                setEmployees(sortedData);
                setFilteredEmployees(activatedEmployees);
                extractFilterValues(sortedData);
                setSelectedEmployees(activatedEmployees);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
        window.addEventListener('employees-imported', fetchData);
        return () => window.removeEventListener('employees-imported', fetchData);
    }, [setSelectedEmployees]);

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
        }

        setFilterValues(values);

        setSelectedFilters(prevFilters => {
            const nextFilters = {};

            Object.entries(prevFilters).forEach(([columnName, selectedOptions]) => {
                if (!Array.isArray(selectedOptions)) {
                    nextFilters[columnName] = selectedOptions;
                    return;
                }

                const availableOptions = values[columnName] || [];
                const validOptions = selectedOptions.filter(option => availableOptions.includes(option));

                if (validOptions.length > 0) {
                    nextFilters[columnName] = validOptions;
                }
            });

            return nextFilters;
        });
    };

    useEffect(() => {
        extractFilterValues(employees);
    }, [employees]);

    const setFilterSelection = (columnName, values) => {
        setSelectedFilters(prevFilters => {
            if (!values.length) {
                const nextFilters = { ...prevFilters };
                delete nextFilters[columnName];
                return nextFilters;
            }
            return { ...prevFilters, [columnName]: values };
        });
    };

    const resetFilters = () => {
        setSelectedFilters({});
        setStartDate('');
        setEndDate('');
        setEmployeeSearch('');
        setDeselectedEmployees(new Set());
        setShowMoreFilters(false);
    };

    const applyFilters = () => {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        const matchingEmployees = employees.filter(employee => {
            const hireDate = new Date(employee['Hire Date']);
            const hasValidHireDate = !Number.isNaN(hireDate.getTime());
            const isInDateRange = (!start && !end)
                || (hasValidHireDate && (!start || hireDate >= start) && (!end || hireDate <= end));
            const normalizedSearch = employeeSearch.trim().toLowerCase();
            const matchesSearch = !normalizedSearch || [employee.Name, employee.Email, employee.Phone]
                .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
            const matchesOtherFilters = Object.entries(selectedFilters).every(([columnName, filterValues]) =>
                filterValues.length === 0 || filterValues.includes(employee[columnName])
            );

            return isInDateRange && matchesSearch && matchesOtherFilters;
        });

        const finalFilteredEmployees = matchingEmployees.filter(employee =>
            employee.isActivated === true && !deselectedEmployees.has(employee._id)
        );

        setFilteredEmployees(matchingEmployees);
        setSelectedEmployees(finalFilteredEmployees);
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

    const handleSelectAllChange = () => {
        const selectableEmployees = filteredEmployees.filter(employee => employee.isActivated === true);
        const allVisibleSelected = selectableEmployees.length > 0
            && selectableEmployees.every(employee => !deselectedEmployees.has(employee._id));
        setDeselectedEmployees(current => {
            const next = new Set(current);
            selectableEmployees.forEach(employee => {
                if (allVisibleSelected) next.add(employee._id);
                else next.delete(employee._id);
            });
            return next;
        });
    };

    const openEmployeeEditor = (employee) => {
        setOriginalEmployee(employee);
        setSelectedEmployee({ ...employee });
        setChangeDetails({ effectiveDate: '', reason: '', payroll: false, insurance: false, retirement: false, trackOther: false });
        setEditError('');
        setIsEditModalOpen(true);
    };

    const handleModalClose = () => {
        setIsEditModalOpen(false);
        setSelectedEmployee(null);
        setOriginalEmployee(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSelectedEmployee(prevEmployee => ({
            ...prevEmployee,
            [name]: value,
        }));
    };

    const handleSaveChanges = async () => {
        const changedFields = editableEmployeeFields.filter(field => String(originalEmployee?.[field] || '').trim() !== String(selectedEmployee?.[field] || '').trim());
        if (!changedFields.length) return setEditError('No information has been changed.');
        const tracked = changeDetails.payroll || changeDetails.insurance || changeDetails.retirement || changeDetails.trackOther;
        const review = changedFields.map(field => `${field}: ${originalEmployee[field] || '(blank)'} â†’ ${selectedEmployee[field] || '(blank)'}`).join('\n');
        if (!window.confirm(`Review the following employee changes:\n\n${review}\n\nCompany App information will be updated immediately.${tracked ? '\nRequired follow-up will also be sent to HR Platform.' : ''}`)) return;
        try {
            const updatedEmployee = { ...originalEmployee };
            changedFields.forEach(field => { updatedEmployee[field] = selectedEmployee[field]; });
            updatedEmployee._employmentChange = { ...changeDetails, changedFields };
            await axios.put(`/employees/${selectedEmployee._id}`, updatedEmployee);
            const displayEmployee = { ...selectedEmployee, Name: [selectedEmployee['Last Name'], selectedEmployee['First Name']].filter(Boolean).join(', '), Supervisor: [selectedEmployee['Supervisor Last Name'], selectedEmployee['Supervisor First Name']].filter(Boolean).join(', ') };
            setEmployees((prevEmployees) => prevEmployees.map((emp) => (emp._id === selectedEmployee._id ? displayEmployee : emp)));
            applyFilters();
            handleModalClose();
        } catch (error) {
            console.error('Error updating employee:', error);
            setEditError(error.response?.data || 'The employee could not be updated.');
        }
    };

    const columns = [
        { id: 'Name', label: 'Name', filter: true, sticky: true },
        { id: 'edit', label: 'Edit Employee', filter: false },
        { id: 'Hire Date', label: 'Hire Date', filter: false },
        { id: 'Position Status', label: 'Status', filter: true },
        { id: 'Home Department', label: 'Home Department', filter: true },
        { id: 'Job Title', label: 'Job Title', filter: true },
        { id: 'Location', label: 'Location', filter: true },
        { id: 'Supervisor', label: 'Supervisor', filter: true },
        { id: 'Phone', label: 'Phone', filter: true },
        { id: 'Email', label: 'Email', filter: true },
        { id: 'Worker Category', label: 'Employment', filter: true },
        { id: 'Pay Category', label: 'Pay', filter: true },
        { id: 'EEOC Establishment', label: 'EEOC', filter: true },
        { id: 'isActivated', label: 'Activated', filter: true },
        { id: 'select', label: 'Select', filter: false },
    ];

    const primaryFilterColumns = [
        { id: 'Position Status', label: 'Status' },
        { id: 'Home Department', label: 'Department' },
        { id: 'Job Title', label: 'Job Title' },
        { id: 'Location', label: 'Location' },
    ];

    const additionalFilterColumns = [
        { id: 'Supervisor', label: 'Supervisor' },
        { id: 'Worker Category', label: 'Employment' },
        { id: 'Pay Category', label: 'Pay Category' },
        { id: 'EEOC Establishment', label: 'EEOC Establishment' },
        { id: 'isActivated', label: 'Activated' },
    ];

    const activeFilterCount = Object.values(selectedFilters)
        .reduce((total, values) => total + (Array.isArray(values) ? values.length : 0), 0);
    const selectableVisibleEmployees = filteredEmployees.filter(employee => employee.isActivated === true);
    const selectedVisibleCount = selectableVisibleEmployees.filter(employee => !deselectedEmployees.has(employee._id)).length;

    const renderFilter = ({ id, label }) => (
        <Autocomplete
            key={id}
            multiple
            disableCloseOnSelect
            options={(filterValues[id] || []).filter(value => value !== null && value !== undefined && value !== '').sort((a, b) => String(a).localeCompare(String(b)))}
            value={selectedFilters[id] || []}
            onChange={(_event, values) => setFilterSelection(id, values)}
            getOptionLabel={(option) => String(option)}
            renderTags={(values, getTagProps) => values.slice(0, 2).map((option, index) => (
                <Chip label={String(option)} size="small" {...getTagProps({ index })} />
            )).concat(values.length > 2 ? [<Chip key="more" label={`+${values.length - 2}`} size="small" />] : [])}
            renderOption={(props, option, { selected }) => (
                <li {...props}>
              ×½<¶‰Ëkºwµç@€€€€€€ñÕÑ½½µÁ±•Ñ”4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€µÕ±Ñ¥Á±”4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½ÁÑ¥½¹Ìõì¡™¥±Ñ•ÉY…±Õ•Ì¹9…µ”ñğmt¤¹™¥±Ñ•È¡	½½±•…¸¤¹Í½ÉĞ ¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘¥±Ñ•ÉÌ¹9…µ”ñğmuô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡}•Ù•¹Ğ°Ù…±Õ•Ì¤€ôøÍ•Ñ¥±Ñ•ÉM•±•Ñ¥½¸ 9…µ”œ°Ù…±Õ•Ì¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€É•¹‘•É%¹ÁÕĞõì¡Á…É…µÌ¤€ôø€ñQ•áÑ¥•±ì¸¸¹Á…É…µÍô±…‰•°ô‰9…µ”ˆ¡•±Á•ÉQ•áĞô‰¡½½Í”½¹”½Èµ½É”•µÁ±½å•”¹…µ•Ì¸ˆÍ¥é”ô‰Íµ…±°ˆ€¼ùô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôÍ´õìÙôµõìÌ¸Õôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñMÑ…¬‘¥É•Ñ¥½¸ô‰É½ÜˆÍÁ…¥¹œõìÅôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±™Õ±±]¥‘Ñ ¥ô‰ÍÑ…ÉĞµ‘…Ñ”ˆ±…‰•°ô‰!¥É”…Ñ”É½´ˆÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õíÍÑ…ÉÑ…Ñ•ô½¹¡…¹”õí¡…¹‘±•MÑ…ÉÑ…Ñ•¡…¹•ô%¹ÁÕÑ1…‰•±AÉ½ÁÌõíìÍ¡É¥¹¬èÑÉÕ”õôÍ¥é”ô‰Íµ…±°ˆ€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±™Õ±±]¥‘Ñ ¥ô‰•¹µ‘…Ñ”ˆ±…‰•°ô‰!¥É”…Ñ”Q¼ˆÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí•¹‘…Ñ•ô½¹¡…¹”õí¡…¹‘±•¹‘…Ñ•¡…¹•ô%¹ÁÕÑ1…‰•±AÉ½ÁÌõíìÍ¡É¥¹¬èÑÉÕ”õôÍ¥é”ô‰Íµ…±°ˆ€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½MÑ…¬ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€ğ½	½àø4(€€€€€€€€€€€€€€€€€€€€ğ½½±±…ÁÍ”ø4(€€€€€€€€€€€€€€€€€€€í…Ñ¥Ù•¥±Ñ•É½Õ¹Ğ€ü€ñMÑ…¬‘¥É•Ñ¥½¸ô‰É½Üˆ…±¥¹%Ñ•µÌô‰•¹Ñ•ÈˆÍÁ…¥¹œõìÅôÍàõíìµĞè€ÈõôøñQåÁ½É…Á¡äÙ…É¥…¹Ğô‰…ÁÑ¥½¸ˆ½±½Èô‰Ñ•áĞ¹Í•½¹‘…ÉäˆùÑ¥Ù”Í•±•Ñ¥½¹Ìèğ½QåÁ½É…Á¡äøñ¡¥À±…‰•°õí…Ñ¥Ù•¥±Ñ•É½Õ¹Ñô½±½Èô‰ÁÉ¥µ…ÉäˆÍ¥é”ô‰Íµ…±°ˆ€¼øğ½MÑ…¬ø€è¹Õ±±ô4(€€€€€€€€€€€€€€€€ğ½	½àø4(€€€€€€€€€€€€ğ½A…Á•Èø4(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁ±½å•”µÍÉ½±±‰…ÈµÁÉ½áäˆÉ•˜õíÑ½ÁMÉ½±±I•™ô½¹MÉ½±°õí¡…¹‘±•Q½Á!½É¥é½¹Ñ…±MÉ½±±ôø4(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁ±½å•”µÍÉ½±±‰…ÈµÁÉ½áäµ¥¹¹•Èˆ€¼ø4(€€€€€€€€€€€€ğ½‘¥Øø4(€€€€€€€€€€€€ñQ…‰±•½¹Ñ…¥¹•È4(€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰•µÁ±½å•”µÑ…‰±”µ½¹Ñ…¥¹•Èˆ(€€€€€€€€€€€€€€€½µÁ½¹•¹ĞõíA…Á•Éô4(€€€€€€€€€€€€€€€É•˜õíÑ…‰±•½¹Ñ…¥¹•ÉI•™ô4(€€€€€€€€€€€€€€€½¹MÉ½±°õí¡…¹‘±•Q…‰±•MÉ½±±ô4(€€€€€€€€€€€€ø4(€€€€€€€€€€€€€€€€ñQ…‰±”±…ÍÍ9…µ”ô‰•µÁ±½å•”µÍ•±•Ñ¥½¸µÑ…‰±”ˆ…É¥„µ±…‰•°ô‰•µÁ±½å•”Í•±•Ñ¥½¸Ñ…‰±”ˆÍÑ¥­å!•…‘•Èø4(€€€€€€€€€€€€€€€€€€€€ñQ…‰±•!•…ø4(€€€€€€€€€€€€€€€€€€€€€€€€ñQ…‰±•I½Üø(€€€€€€€€€€€€€€€€€€€€€€€€€€€í½±Õµ¹Ì¹µ…À ¡½±Õµ¸¤€ôø€ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ…‰±••±°(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€­•äõí½±Õµ¸¹¥‘ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí½±Õµ¸¹ÍÑ¥­ä€ü€•µÁ±½å•”µ¹…µ”µ•±°•µÁ±½å•”µ¹…µ”µ¡•…‘•Èœ€è€œô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í½±Õµ¸¹¥€ôôô€Í•±•Ğœ€ü€ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€™±•àœ°…±¥¹%Ñ•µÌè€•¹Ñ•Èœõôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¡•­‰½à4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡•­•õíÍ•±•Ñ…‰±•Y¥Í¥‰±•µÁ±½å••Ì¹±•¹Ñ €ø€À€˜˜Í•±•Ñ…‰±•Y¥Í¥‰±•µÁ±½å••Ì¹•Ù•Éä¡•µÁ±½å•”€ôø€…‘•Í•±•Ñ•‘µÁ±½å••Ì¹¡…Ì¡•µÁ±½å•”¹}¥¤¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥¹‘•Ñ•Éµ¥¹…Ñ”õíÍ•±•Ñ…‰±•Y¥Í¥‰±•µÁ±½å••Ì¹Í½µ”¡•µÁ±½å•”€ôø€…‘•Í•±•Ñ•‘µÁ±½å••Ì¹¡…Ì¡•µÁ±½å•”¹}¥¤¤€˜˜Í•±•Ñ…‰±•Y¥Í¥‰±•µÁ±½å••Ì¹Í½µ”¡•µÁ±½å•”€ôø‘•Í•±•Ñ•‘µÁ±½å••Ì¹¡…Ì¡•µÁ±½å•”¹}¥¤¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•M•±•Ñ±±¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½±½Èô‰ÁÉ¥µ…Éäˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸ùM•±•Ğğ½ÍÁ…¸ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½‘¥Øø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€è½±Õµ¸¹±…‰•±ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½Q…‰±••±°ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€ğ½Q…‰±•I½Üø4(€€€€€€€€€€€€€€€€€€€€ğ½Q…‰±•!•…ø4(4(€€€€€€€€€€€€€€€€€€€€ñQ…‰±•	½‘äø4(€€€€€€€€€€€€€€€€€€€€€€€í™¥±Ñ•É•‘µÁ±½å••Ì¹µ…À ¡•µÁ±½å•”¤€ôø€ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ…‰±•I½Ü(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€­•äõí•µÁ±½å•”¹}¥‘ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí‘•Í•±•Ñ•‘µÁ±½å••Ì¹¡…Ì¡•µÁ±½å•”¹}¥¤€ü€•µÁ±½å•”µÉ½Üµ‘•Í•±•Ñ•œ€è€œô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í½±Õµ¹Ì¹µ…À ¡½±Õµ¸¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ…‰±••±°­•äõí½±Õµ¸¹¥‘ô±…ÍÍ9…µ”õí½±Õµ¸¹ÍÑ¥­ä€ü€•µÁ±½å•”µ¹…µ”µ•±°œ€è€œôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í½±Õµ¸¹¥€ôôô€•‘¥Ğœ€ü€ñ	ÕÑÑ½¸ÍÑ…ÉÑ%½¸õìñ‘¥Ñ=ÕÑ±¥¹•‘%½¸€¼ùô½¹±¥¬õì ¤€ôø½Á•¹µÁ±½å••‘¥Ñ½È¡•µÁ±½å•”¥ôÍ¥é”ô‰Íµ…±°ˆÙ…É¥…¹Ğô‰½ÕÑ±¥¹•ˆù‘¥Ğğ½	ÕÑÑ½¸ø€è½±Õµ¸¹¥€ôôô€Í•±•Ğœ€ü€ (€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ¡•­‰½à4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¡•­•õí•µÁ±½å•”¹¥ÍÑ¥Ù…Ñ•€ôôôÑÉÕ”€˜˜€…‘•Í•±•Ñ•‘µÁ±½å••Ì¹¡…Ì¡•µÁ±½å•”¹}¥¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€‘¥Í…‰±•õí•µÁ±½å•”¹¥ÍÑ¥Ù…Ñ•€„ôôÑÉÕ•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì ¤€ôø¡…¹‘±•¡•­‰½á¡…¹”¡•µÁ±½å•”¹}¥¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½±½Èô‰ÁÉ¥µ…Éäˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤€è€ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½±Õµ¸¹¥€ôôô€!¥É”…Ñ”œ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü™½Éµ…ÑµÁ±½å••…Ñ”¡•µÁ±½å••m½±Õµ¸¹¥‘t¤4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è½±Õµ¸¹¥€ôôô€¥ÍÑ¥Ù…Ñ•œ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ü€ñ¡¥À±…ÍÍ9…µ”ô‰•µÁ±½å•”µ…Ñ¥Ù…Ñ¥½¸µ¡¥Àˆ±…‰•°õí•µÁ±½å••m½±Õµ¸¹¥‘t€ü€QÉÕ”œ€è€…±Í”ô½±½Èõí•µÁ±½å••m½±Õµ¸¹¥‘t€ü€ÍÕ•ÍÌœ€è€‘•™…Õ±ĞôÍ¥é”ô‰Íµ…±°ˆÙ…É¥…¹Ğõí•µÁ±½å••m½±Õµ¸¹¥‘t€ü€™¥±±•œ€è€½ÕÑ±¥¹•ô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€è•µÁ±½å••m½±Õµ¸¹¥‘tñğ€œœ(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½Q…‰±••±°ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¤¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½Q…‰±•I½Üø4(€€€€€€€€€€€€€€€€€€€€€€€€¤¥ô4(€€€€€€€€€€€€€€€€€€€€ğ½Q…‰±•	½‘äø4(€€€€€€€€€€€€€€€€ğ½Q…‰±”ø4(€€€€€€€€€€€€ğ½Q…‰±•½¹Ñ…¥¹•Èø4(4(€€€€€€€€€€€€ñ¥…±½œ½Á•¸õí¥Í‘¥Ñ5½‘…±=Á•¹ô½¹±½Í”õí¡…¹‘±•5½‘…±±½Í•ôµ…á]¥‘Ñ ô‰µˆ™Õ±±]¥‘Ñ ø(€€€€€€€€€€€€€€€€ñ¥…±½Q¥Ñ±”ù‘¥ĞµÁ±½å•”%¹™½Éµ…Ñ¥½¸ğ½¥…±½Q¥Ñ±”ø(€€€€€€€€€€€€€€€€ñ¥…±½½¹Ñ•¹Ğø(€€€€€€€€€€€€€€€€€€€íÍ•±•Ñ•‘µÁ±½å•”€˜˜€ (€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥½¹Ñ…¥¹•ÈÍÁ…¥¹œõìÉôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ±•ÉĞÍ•Ù•É¥Ñäô‰¥¹™¼ˆù‘¥ĞÑ¡”¥¹™½Éµ…Ñ¥½¸‰•±½Ü¸Q¡”ÍåÍÑ•´İ¥±°…ÕÑ½µ…Ñ¥…±±ä¥‘•¹Ñ¥™äÑ¡”™¥•±‘ÌÑ¡…Ğ¡…¹•¸½µÁ…¹äÁÀÕÁ‘…Ñ•ÌÑ…­”•™™•Ğ¥µµ•‘¥…Ñ•±ä¸ğ½±•ÉĞø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€í•‘¥ÑÉÉ½È€ü€ñ±•ÉĞÍ•Ù•É¥Ñäô‰•ÉÉ½ÈˆÍàõíìµĞè€Äõôùí•‘¥ÑÉÉ½Éôğ½±•ÉĞø€è¹Õ±±ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÙôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰¥ÉÍĞ9…µ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰¥ÉÍĞ9…µ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••l¥ÉÍĞ9…µ”uô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÙôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰1…ÍĞ9…µ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰1…ÍĞ9…µ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••l1…ÍĞ9…µ”uô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÙôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰!¥É”…Ñ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰!¥É”…Ñ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‘…Ñ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí•µÁ±½å••…Ñ•%¹ÁÕÑY…±Õ”¡Í•±•Ñ•‘µÁ±½å••l!¥É”…Ñ”t¥ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€%¹ÁÕÑ1…‰•±AÉ½ÁÌõíìÍ¡É¥¹¬èÑÉÕ”õô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÙôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰!½µ”•Á…ÉÑµ•¹Ğˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰!½µ”•Á…ÉÑµ•¹Ğˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••l!½µ”•Á…ÉÑµ•¹Ğuô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÙôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰MÕÁ•ÉÙ¥Í½È¥ÉÍĞ9…µ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰MÕÁ•ÉÙ¥Í½È¥ÉÍĞ9…µ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••lMÕÁ•ÉÙ¥Í½È¥ÉÍĞ9…µ”uô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÙôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰MÕÁ•ÉÙ¥Í½È1…ÍĞ9…µ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰MÕÁ•ÉÙ¥Í½È1…ÍĞ9…µ”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••lMÕÁ•ÉÙ¥Í½È1…ÍĞ9…µ”uô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰)½ˆQ¥Ñ±”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰)½ˆQ¥Ñ±”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••l)½ˆQ¥Ñ±”uô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰1½…Ñ¥½¸ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰1½…Ñ¥½¸ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••l1½…Ñ¥½¸uô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰µ…¥°ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰µ…¥°ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••lµ…¥°uô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰A¡½¹”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰A¡½¹”ˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••lA¡½¹”uô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰=ÍÑ…‰±¥Í¡µ•¹Ğˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰=ÍÑ…‰±¥Í¡µ•¹Ğˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••l=ÍÑ…‰±¥Í¡µ•¹Ğuô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰µÁ±½åµ•¹Ğ…Ñ•½Éäˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰]½É­•È…Ñ•½Éäˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••l]½É­•È…Ñ•½Éäuô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôø4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñQ•áÑ¥•±4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€™Õ±±]¥‘Ñ 4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€±…‰•°ô‰A…ä…Ñ•½Éäˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¹…µ”ô‰A…ä…Ñ•½Éäˆ4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘µÁ±½å••lA…ä…Ñ•½Éäuô4(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õí¡…¹‘±•%¹ÁÕÑ¡…¹•ô(€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôøñQåÁ½É…Á¡äÙ…É¥…¹Ğô‰ Øˆù!HÑ¥½¸QÉ…­¥¹œğ½QåÁ½É…Á¡äøñQåÁ½É…Á¡äÙ…É¥…¹Ğô‰‰½‘äÈˆ½±½Èô‰Ñ•áĞ¹Í•½¹‘…ÉäˆùA…åÉ½±°°%¹ÍÕÉ…¹”°…¹€ĞÀÄ¡¬¤¡…¹•Ì…É”…±İ…åÌÑÉ…¹Í™•ÉÉ•Ñ¼!HA±…Ñ™½É´¸½È½Ñ¡•È¡…¹•Ì°¡½½Í”İ¡•Ñ¡•È!H™½±±½ÜµÕÀ¥Ì¹••‘•¸ğ½QåÁ½É…Á¡äøğ½É¥ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôÍ´õìÑôøñ½Éµ½¹ÑÉ½±1…‰•°½¹ÑÉ½°õìñ¡•­‰½à¡•­•õí¡…¹••Ñ…¥±Ì¹Á…åÉ½±±ô½¹¡…¹”õí•Ù•¹Ğ€ôøÍ•Ñ¡…¹••Ñ…¥±Ì¡ÕÉÉ•¹Ğ€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°Á…åÉ½±°è•Ù•¹Ğ¹Ñ…É•Ğ¹¡•­•ô¤¥ô€¼ùô±…‰•°ô‰A…åÉ½±°¡…¹”¹••‘•ˆ€¼øğ½É¥ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôÍ´õìÑôøñ½Éµ½¹ÑÉ½±1…‰•°½¹ÑÉ½°õìñ¡•­‰½à¡•­•õí¡…¹••Ñ…¥±Ì¹¥¹ÍÕÉ…¹•ô½¹¡…¹”õí•Ù•¹Ğ€ôøÍ•Ñ¡…¹••Ñ…¥±Ì¡ÕÉÉ•¹Ğ€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°¥¹ÍÕÉ…¹”è•Ù•¹Ğ¹Ñ…É•Ğ¹¡•­•ô¤¥ô€¼ùô±…‰•°ô‰%¹ÍÕÉ…¹”¡…¹”¹••‘•ˆ€¼øğ½É¥ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôÍ´õìÑôøñ½Éµ½¹ÑÉ½±1…‰•°½¹ÑÉ½°õìñ¡•­‰½à¡•­•õí¡…¹••Ñ…¥±Ì¹É•Ñ¥É•µ•¹Ñô½¹¡…¹”õí•Ù•¹Ğ€ôøÍ•Ñ¡…¹••Ñ…¥±Ì¡ÕÉÉ•¹Ğ€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°É•Ñ¥É•µ•¹Ğè•Ù•¹Ğ¹Ñ…É•Ğ¹¡•­•ô¤¥ô€¼ùô±…‰•°ôˆĞÀÄ¡¬¤¡…¹”¹••‘•ˆ€¼øğ½É¥ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñÉ¥¥Ñ•´áÌõìÄÉôøñ½Éµ½¹ÑÉ½±1…‰•°½¹ÑÉ½°õìñ¡•­‰½à¡•­•õí¡…¹••Ñ…¥±Ì¹ÑÉ…­=Ñ¡•Éô½¹¡…¹”õí•Ù•¹Ğ€ôøÍ•Ñ¡…¹••Ñ…¥±Ì¡ÕÉÉ•¹Ğ€ôø€¡ì€¸¸¹ÕÉÉ•¹Ğ°ÑÉ…­=Ñ¡•Èè•Ù•¹Ğ¹Ñ…É•Ğ¹¡•­•ô¤¥ô€¼ùô±…‰•°ô‰QÉ…¬Ñ¡¥Ì¹½¸µ™¥¹…¹¥…°¡…¹”¥¸!HA±…Ñ™½É´ˆ€¼øğ½É¥ø(€€€€€€€€€€€€€€€€€€€€€€€€€€€ì¡¡…¹••Ñ…¥±Ì¹Á…åÉ½±°ñğ¡…¹••Ñ…¥±Ì¹¥¹ÍÕÉ…¹”ñğ¡…¹••Ñ…¥±Ì¹É•Ñ¥É•µ•¹Ğñğ¡…¹••Ñ…¥±Ì¹ÑÉ…­=Ñ¡•È¤€˜˜€ñÉ¥¥Ñ•´áÌõìÄÉôøñ±•ÉĞÍ•Ù•É¥Ñäô‰¥¹™¼ˆùQ¡¥ÌÉ•½Éİ¥±°‰”Í•¹ĞÑ¼µÁ±½åµ•¹Ğ¡…¹”¸!HÑ¥½¸…Ñ”…¹™½±±½ÜµÕÀ‘•Ñ…¥±Ìİ¥±°‰”•¹Ñ•É•Ñ¡•É”¸ğ½±•ÉĞøğ½É¥ùô(€€€€€€€€€€€€€€€€€€€€€€€€ğ½É¥ø(€€€€€€€€€€€€€€€€€€€€¥ô4(€€€€€€€€€€€€€€€€ğ½¥…±½½¹Ñ•¹Ğø4(€€€€€€€€€€€€€€€€ñ¥…±½Ñ¥½¹Ìø4(€€€€€€€€€€€€€€€€€€€€ñ	ÕÑÑ½¸½¹±¥¬õí¡…¹‘±•5½‘…±±½Í•ôù…¹•°ğ½	ÕÑÑ½¸ø4(€€€€€€€€€€€€€€€€€€€€ñ	ÕÑÑ½¸½¹±¥¬õí¡…¹‘±•M…Ù•¡…¹•Íô½±½Èô‰ÁÉ¥µ…ÉäˆÙ…É¥…¹Ğô‰½¹Ñ…¥¹•ˆùI•Ù¥•Ü¡…¹•Ì€˜½¹™¥É´ğ½	ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ğ½¥…±½Ñ¥½¹Ìø4(€€€€€€€€€€€€ğ½¥…±½œø4(€€€€€€€€ğ½‘¥Øø4(€€€€¤ì4)ô4(4)•áÁ½ÉĞ‘•™…Õ±ĞµÁ±½å••M•±•Ñ¥½¹½µÁ½¹•¹Ğì4(4(