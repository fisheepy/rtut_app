import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { buildRecipientPreview } from './recipientPreviewUtils';

function BulkRecipientConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  instruction,
  confirmLabel,
  emptyMessage,
  selectedEmployees,
  metadata = [],
  topContent,
  previewLimit = 20,
}) {
  const recipientPreview = useMemo(() => buildRecipientPreview(selectedEmployees), [selectedEmployees]);
  const previewEmployees = recipientPreview.slice(0, previewLimit);
  const remainingCount = Math.max(recipientPreview.length - previewLimit, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{instruction}</DialogContentText>

        {topContent}

        {metadata.map((item) => (
          <Typography key={item.label} sx={{ mt: 1 }}>
            <strong>{item.label}:</strong> {item.value || '-'}
          </Typography>
        ))}

        <Box sx={{ display: 'flex', gap: 1, my: 2, flexWrap: 'wrap' }}>
          <Chip color="warning" label={`Selected: ${recipientPreview.length}`} />
          <Chip color="info" label={`Previewing first: ${previewEmployees.length}`} />
        </Box>

        <Box sx={{ border: '1px solid #e4e7ec', borderRadius: 2, maxHeight: 340, overflowY: 'auto', background: '#fcfcfd' }}>
          {recipientPreview.length === 0 ? (
            <Typography sx={{ p: 2, color: '#b42318', fontWeight: 600 }}>{emptyMessage}</Typography>
          ) : (
            <List dense>
              {previewEmployees.map((employee, index) => (
                <React.Fragment key={employee.id}>
                  <ListItem>
                    <ListItemText
                      primary={`${index + 1}. ${employee.fullName}`}
                      secondary={`Location: ${employee.location} • Department: ${employee.department}`}
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                  {index < previewEmployees.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>

        {remainingCount > 0 && (
          <Typography sx={{ mt: 1, color: '#475467' }}>
            ...and {remainingCount} more employee(s) in the selected list.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} color="primary" disabled={recipientPreview.length === 0}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BulkRecipientConfirmDialog;
