import env from "dotenv";
env.config();
import fetch from 'node-fetch';

const apiUrl = `https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items?token=${process.env.API_TOKEN}`;

import Airtable from "airtable";

var base = new Airtable({
  apiKey: process.env.ACCESS_KEY,
}).base("appk3PmNGPCJdwPD0");

var table = base("JobsByClient");

export const getJobs = async (req, res) => {
  // console.log(req.body);

  // data need from the client
  const {
    job_keywords,
    companyList,
    job_location,
    job_posted_date,
    job_mode,
    totalJobs,
  } = req.body;

  // console.log(
  //   job_keywords + " " + typeof job_keywords,
  //   companyList + " " + typeof companyList,
  //   job_location + " " + typeof job_location,
  //   job_posted_date + " " + typeof job_posted_date,
  //   job_mode + " " + typeof job_mode,
  //   totalJobs + " " + typeof totalJobs
  // );

  let titleArray = job_keywords.split(",");

  let company_list = companyList.split(",");

  // console.log("companyList: " + company_list + " " + typeof company_list);

  // make all a new promise
  const fetchDataForTitle = async (title) => {
    return new Promise(async (resolve, reject) => {
      let requestData = {
        title,
        location: job_location,
      };

      if (company_list !== "") {
        requestData.companyName = company_list;
      }

      if (job_posted_date !== "") {
        requestData.publishedAt = job_posted_date;
      }

      if (job_mode !== "") {
        requestData.workType = job_mode;
      }

      if (totalJobs !== "") {
        requestData.rows = parseInt(totalJobs);
      }

      // console.log(requestData);

      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      };

      try {
        const response = await fetch(apiUrl, requestOptions);
        const data = await response.json();
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  };

  const fetchAllData = async () => {
    try {
      const promises = titleArray.map((title) => fetchDataForTitle(title));
      const dataArray = await Promise.all(promises);
      return dataArray;
    } catch (error) {
      throw error;
    }
  };

  var noOfJobs = 0;

  const getAllData = async () => {
    try {
      const responseDataArray = await fetchAllData();

      // Merge all the response data into a single array
      let allJobs = [];
      responseDataArray.forEach((data) => {
        allJobs = allJobs.concat(data);
      });

      // console.log(allJobs);

      noOfJobs = allJobs.length;

      if (noOfJobs > 0) {
        // console.log(`Total number of jobs Found: ${noOfJobs}`);

        const uniqueJobSet = new Set();
        const job_title = new Set();

        for (let i = 0; i < noOfJobs; i++) {
          const job = allJobs[i];
          const x = `${job.title} ${job.companyName}`;

          if (
            job !== null &&
            job !== undefined &&
            job !== "" &&
            !job_title.has(x)
          ) {
            if (
              job.contractType !== "Internship" &&
              job.contractType !== "internship"
            ) {
              uniqueJobSet.add(job);
              job_title.add(x);
            }
          }
        }

        // updating table with all jobs
        await updateTable(uniqueJobSet, res);
      } else {
        res.json({
          message: "No jobs found",
          length: 0,
        });
      }
    } catch (error) {
      res.json({
        message: "Error: " + error,
      });
    }
  };

  await getAllData();
};

async function updateTable(uniqueJobSet, res) {
  for (let job of uniqueJobSet) {
    const jobTitle = job.title;
    const jobUrl = job.jobUrl;
    const publishedAt = job.publishedAt;
    const salary = job.salary;
    const linkedinUrl = job.companyUrl;
    const location = job.location;
    const jobPostedTime = job.postedTime;
    const applicationsCount = job.applicationsCount;
    const JobDescription = job.description;
    const contractType = job.contractType;
    const experienceLevel = job.experienceLevel;
    const work_type = job.workType;
    const sector = job.sector;
    const companyId = job.companyId;
    let companyName = job.companyName;

    // create row on airtable
    try {
      await table.create(
        [
          {
            fields: {
              "Job Title": jobTitle,
              "Job Url": jobUrl,
              "Published At": publishedAt,
              Salary: salary,
              "Linkedin Url": linkedinUrl,
              "Job Location": location,
              "Job Posted Time": jobPostedTime,
              "Applications Count": applicationsCount,
              "Job Description": JobDescription,
              "Employment Type": contractType,
              "Experience Level": experienceLevel,
              "Work Type": work_type,
              Industry: sector,
              "Company Id": companyId,
              "Company Name": companyName,
            },
          },
        ],
        function (err, records) {
          if (err) {
            console.error(err);
            return;
          }
        }
      );

      // console.log(`Job "${jobTitle}" added to Airtable.`);
    } catch (error) {
      // console.log("Update failed");
      // console.log("Error: ", error);
    }
  }

  // console.log("All jobs added to Airtable");

  // send response to client
  res.json({
    message: "All jobs added to Airtable",
    length: uniqueJobSet.length,
  });
}
