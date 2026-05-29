const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compareCommissionRosterFiles } = require('./parser');
const { writeCommissionRosterReport, writeCommissionRosterHtmlReport } = require('./reportWriter');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function createCommissionRosterRouter({ upload, uploadDirectory, logOperationToDatabase }) {
  const router = express.Router();
  const jobsDir = path.join(uploadDirectory, 'commission-roster');
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

    res.download(metadata.reportPath, metadata.reportFileName || 'Commission_Roster_Mapping_Report.xlsx');
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
    { name: 'rosterFile', maxCount: 1 },
    { name: 'quarterlyReportFile', maxCount: 1 },
  ]), async (req, res) => {
    const rosterFile = req.files?.rosterFile?.[0];
    const quarterlyReportFile = req.files?.quarterlyReportFile?.[0];
    const adminUser = req.body?.adminUser ? safeJsonParse(req.body.adminUser) : req.adminSession;

    if (!rosterFile || !quarterlyReportFile) {
      return res.status(400).json({ error: 'Both rosterFile and quarterlyReportFile are required.' });
    }

    const jobId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const jobDir = path.join(jobsDir, jobId);
    ensureDir(jobDir);

    const reportFileName = `Commission_Roster_Mapping_Report_${jobId}.xlsx`;
    const htmlReportFileName = `Commission_Roster_Mapping_Report_${jobId}.html`;
    const reportPath = path.join(jobDir, reportFileName);
    const htmlReportPath = path.join(jobDir, htmlReportFileName);
    const metadataPath = path.join(jobDir, 'metadata.json');
    const createdAt = new Date().toISOString();

    try {
      const result = compareCommissionRosterFiles({
        rosterFilePath: rosterFile.path,
        quarterlyReportFilePath: quarterlyReportFile.path,
      });

      await writeCommissionRosterReport(result, reportPath);
      writeCommissionRosterHtmlReport(result, htmlReportPath);

      const metadata = {
        jobId,
        status: 'completed',
        createdAt,
        completedAt: new Date().toISOString(),
        rosterFileName: rosterFile.originalname,
        quarterlyReportFileName: quarterlyReportFile.originalname,
        reportFileName,
        htmlReportFileName,
        reportPath,
        htmlReportPath,
        reportUrl: `/api/commission-roster/jobs/${jobId}/report`,
        htmlReportUrl: `/api/commission-roster/jobs/${jobId}/html`,
        summary: result.summary,
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      await logOperationToDatabase?.({
        action: 'commission_roster_mapping',
        adminUser,
        selectedEmployees: [],
        payloadSummary: {
          jobId,
          rosterFileName: rosterFile.originalname,
          quarterlyReportFileName: quarterlyReportFile.originalname,
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
        rosterFileName: rosterFile.originalname,
        quarterlyReportFileName: quarterlyReportFile.originalname,
        error: error.message,
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      await logOperationToDatabase?.({
        action: 'commission_roster_mapping',
        adminUser,
        selectedEmployees: [],
        payloadSummary: {
          jobId,
          rosterFileName: rosterFile.originalname,
          quarterlyReportFileName: quarterlyReportFile.originalname,
        },
        status: 'failed',
        errorMessage: error.stack || error.message,
      });

      res.status(500).json({ error: error.message, jobId });
    } finally {
      [rosterFile.path, quarterlyReportFile.path].forEach((filePath) => {
        fs.unlink(filePath, () => {});
      });
    }
  });

  return router;
}

module.exports = { createCommissionRosterRouter };
