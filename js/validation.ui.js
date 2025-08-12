// Extracted from validation.html (UI-only)
document.addEventListener("DOMContentLoaded", function() {
      // STEP 1: Display previous level/progress and identification result.
      // Use fallback defaults if session storage is missing.
      var prevUserLevel = sessionStorage.getItem('prevUserLevel') || "1";
      var prevUserProgress = sessionStorage.getItem('prevUserProgress') || "0"; // in %
      var speciesName = sessionStorage.getItem('speciesName') || "Unknown Species";
      
      // Set header to previous values.
      document.getElementById('levelNumber').textContent = prevUserLevel;
      document.getElementById('levelProgressBar').style.width = prevUserProgress + '%';
      
      // Display the identification result.
      document.getElementById('identificationResult').textContent = "Identified Species: " + speciesName;
      
      // STEP 2: Animate the points details and counter.
      var prevTotalPoints = parseInt(sessionStorage.getItem('prevTotalPoints')) || 0;
      var newTotalPoints = parseInt(sessionStorage.getItem('newTotalPoints')) || (prevTotalPoints + 100);
      var resultsHTML = sessionStorage.getItem('resultsHTML') || "<p>Species observation: 100 points</p><p>Extra bonus: 50 points</p>";
      
      animatePointsDetailsAndCounter(prevTotalPoints, newTotalPoints, resultsHTML)
        .then(function() {
          // STEP 3: Display the mission level badge.
          var missionLevel = sessionStorage.getItem('missionLevel') || "Common";
          var levelClass = sessionStorage.getItem('levelClass') || "common-points";
          return displayMissionLevelBadge(missionLevel, levelClass);
        })
        .then(function() {
          // STEP 4: Update the header with the new level and progress.
          var newUserLevel = sessionStorage.getItem('newUserLevel') || prevUserLevel;
          var newUserProgress = sessionStorage.getItem('newUserProgress') || prevUserProgress;
          return updateHeaderLevel(newUserLevel, newUserProgress);
        })
        .catch(function(err) {
          console.error(err);
        });
      
      // Close button functionality: hide the validation view (assumes it's in an iframe).
      document.getElementById('closeValidationBtn').addEventListener('click', function() {
        if(window.parent && window.parent.document.getElementById('validationFrameContainer')){
          window.parent.document.getElementById('validationFrameContainer').style.display = 'none';
        }
      });
    });
    
    // Animate the points details and counter sequentially.
    function animatePointsDetailsAndCounter(prevPoints, newPoints, detailsHTML) {
      return new Promise(function(resolve) {
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = detailsHTML;
        var detailsArray = Array.from(tempDiv.children);
        var container = document.getElementById('pointsDetailsContainer');
        container.innerHTML = "";
        
        // Total duration based on number of lines (300ms per line).
        var totalDuration = detailsArray.length * 300;
        
        // Animate the counter from prevPoints to newPoints over the total duration.
        animateCounter(prevPoints, newPoints, totalDuration);
        
        // Reveal each detail line one by one.
        let index = 0;
        function showNextDetail() {
          if (index < detailsArray.length) {
            var detailElem = detailsArray[index];
            detailElem.style.opacity = 0;
            container.appendChild(detailElem);
            setTimeout(function() {
              detailElem.style.opacity = 1;
            }, 50);
            index++;
            setTimeout(showNextDetail, 300);
          } else {
            resolve();
          }
        }
        showNextDetail();
      });
    }
    
    // Animate the counter from start to end over a given duration.
    function animateCounter(start, end, duration) {
      var counterElem = document.getElementById('pointsCounter');
      var steps = duration / 50;
      var increment = (end - start) / steps;
      var current = start;
      var interval = setInterval(function() {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
          current = end;
          clearInterval(interval);
        }
        counterElem.textContent = Math.floor(current);
      }, 50);
    }
    
    // Display the mission level badge with a fade-in effect.
    function displayMissionLevelBadge(missionLevel, levelClass) {
      return new Promise(function(resolve) {
        var badgeContainer = document.getElementById('missionBadgeContainer');
        badgeContainer.innerHTML = "<p class='mission-level " + levelClass + "' style='opacity:0;'>" + missionLevel + "</p>";
        badgeContainer.style.display = 'block';
        setTimeout(function() {
          badgeContainer.firstChild.style.opacity = 1;
          resolve();
        }, 300);
      });
    }
    
    // Update the header with the new level and progress.
    function updateHeaderLevel(newLevel, newProgress) {
      return new Promise(function(resolve) {
        document.getElementById('levelNumber').textContent = newLevel;
        document.getElementById('levelProgressBar').style.width = newProgress + '%';
        setTimeout(resolve, 500);
      });
    }