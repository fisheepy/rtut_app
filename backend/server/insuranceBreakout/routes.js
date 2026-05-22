const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compareInsuranceFiles } = require('./parser');
const { writeInsuranceExcelReport, writeInsuranceHtmlReport } = require('./reportWriter');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function readJobs(jobsDir) {
  if (!fs.existsSync(jobsDir)) return [];
  return fs.readdirSync(jobsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metadataPath = path.join(jobsDir, entry.name, 'metadata.json');
      if (!fs.existsSync(metadataPath)) return null;
      try {
        return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function createInsuranceBreakoutRouter({ upload, uploadDirectory, logOperationToDatabase }) {
  const router = express.Router();
  const jobsDir = path.join(uploadDirectory, 'insurance-breakout');
  ensureDir(jobsDir);

  router.get('/jobs', (req, res) => {
    res.json(readJobs(jobsDir).slice(0, 20));
  });

  router.get('/jobs/:jobId', (req, res) => {
    const metadataPath = path.join(jobsDir, req.params.jobId, 'metadata.json');
    if (!fs.existsSync(metadataPath)) return res.status(404).json({ error: 'Job not found' });
    res.json(JSON.parse(fs.readFileSync(metadataPath, 'utf8')));
  });

  router.get('/jobs/:jobId/report', (req, res) => {
    const metadataPath = path.join(jobsDir, req.params.jobId, 'metadata.json');
    if (!fs.existsSync(metadataPath)) return res.status(404).json({ error: 'Job not found' });
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (metadata.status !== 'completed' || !metadata.reportPath || !fs.existsSync(metadata.reportPath)) {
      return res.status(404).json({ error: 'Report is not available' });
    }
    res.download(metadata.reportPath, metadata.reportFileName || 'Insurance_Breakout_Report.xlsx');
  });

  router.get('/jobs/:jobId/html', (req, res) => {
    const metadataPath = path.join(jobsDir, req.params.jobId, 'metadata.json');
    if (!fs.existsSync(metadataPath)) return res.status(404).json({ error: 'Job not found' });
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (metadata.status !== 'completed' || !metadata.htmlReportPath || !fs.existsSync(metadata.htmlReportPath)) {
      return res.status(404).json({ error: 'HTML report is not available' });
    }
    res.sendFile(metadata.htmlReportPath);
  });

  router.post('/jobs', upload.fields([
    { name: 'payrollFile', maxCount: 1 },
    { name: 'dentalFile', maxCount: 1 },
    { name: 'visionFile', maxCount: 1 },
    { name: 'ltdLifeSuppFile', maxCount: 1 },
  ]), async (req, res) => {
    const payrollFile = req.files?.payrollFile?.[0];
    const dentalFile = req.files?.dentalFile?.[0];
    const visionFile = req.files?.visionFile?.[0];
    const ltdLifeSuppFile = req.files?.ltdLifeSuppFile?.[0];
    const adminUser = req.body?.adminUser ? safeJsonParse(req.body.adminUser) : null;
    const uploadedFiles = [payrollFile, dentalFile, visionFile, ltdLifeSuppFile].filter(Boolean);

    if (!payrollFile || !dentalFile || !visionFile || !ltdLifeSuppFile) {
      uploadedFiles.forEach((file) => fs.unlink(file.path, () => {}));
      return res.status(400).json({ error: 'Payroll, dental, vision, and LTD/Life/SUPP files are required.' });
    }

    const jobId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const jobDir = path.join(jobsDir, jobId);
    ensureDir(jobDir);

    const reportFileName = `Insurance_Breakout_Report_${jobId}.xlsx`;
    const htmlReportFileName = `Insurance_Breakout_Report_${jobId}.html`;
    const reportPath = path.join(jobDir, reportFileName);
    const htmlReportPath = path.join(jobDir, htmlReportFileName);
    const metadataPath = path.join(jobDir, 'metadata.json');
    const createdAt = new Date().toISOString();

    try {
      const result = compareInsuranceFiles({
        payrollFilePath: payrollFile.path,
        dentalFilePath: dentalFile.path,
        visionFilePath: visionFile.path,
        ltdLifeSuppFilePath: ltdLifeSuppFile.path,
      });

      await writeInsuranceExcelReport(result, reportPath);
      writeInsuranceHtmlReport(result, htmlReportPath);

      const metadata = {
        jobId,
        status: 'completed',
        createdAt,
        completedAt: new Date().toISOString(),
        payrollFileName: payrollFile.originalname,
        dentalFileName: dentalFile.originalname,
        visionFileName: visionFile.originalname,
        ltdLifeSuppFileName: ltdLifeSuppFile.originalname,
        reportFileName,
        htmlReportFileName,
        reportPath,
        htmlReportPath,
        reportUrl: `/api/insurance-breakout/jobs/${jobId}/report`,
        htmlReportUrl: `/api/insurance-breakout/jobs/${jobId}/html`,
        summary: result.summary,
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      await logOperationToDatabase?.({
        action: 'insurance_breakout',
        adminUser,
        selectedEmployees: [],
        payloadSummary: {
          jobId,
          payrollFileName: payrollFile.originalname,
          dentalFileName: dentalFile.originalname,
          visionFileName: visionFile.originalname,
          ltdLifeSuppFileName: ltdLifeSuppFile.originalname,
          summary: result.summary,
        },
        status: 'success',
      });

      res.json(metadata);
    } catch (error) {
      const metadata = {
        jobId,
        status: 'failed',
        createdAt,
        completedAt: new Date().toISOString(),
        payrollFileName: payrollFile.originalname,
        dentalFileName: dentalFile.originalname,
        visionFileName: visionFile.originalname,
        ltdLifeSuppFileName: ltdLifeSuppFile.originalname,
        error: error.message,
      };
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      await logOperationToDatabase?.({
        action: 'insurance_breakout',
        adminUser,
        selectedEmployees: [],
        payloadSummary: { jobId },
        status: 'failed',
        errorMessage: error.stack || error.message,
      });
      res.status(500).json({ error: error.message, jobId });
    } finally {
      uploadedFiles.forEach((file) => fs.unlink(file.path, () => {}));
    }
  });

  return router;
}

module.exports = { createInsuranceBreakoutRouter };
