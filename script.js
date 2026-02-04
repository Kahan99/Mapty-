'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener(
      'click',
      this._handleWorkoutClick.bind(this),
    );

    // Control buttons
    document
      .querySelector('.btn--show-all')
      ?.addEventListener('click', this._showAllWorkouts.bind(this));
    document
      .querySelector('.btn--delete-all')
      ?.addEventListener('click', this._deleteAllWorkouts.bind(this));
    document.querySelectorAll('.btn--sort').forEach(btn => {
      btn.addEventListener('click', e => {
        this._sortWorkouts(e.target.dataset.sort);
      });
    });
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert(
            '⚠️ Could not get your position. Please enable location services.',
          );
        },
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _showAllWorkouts() {
    if (this.#workouts.length === 0) return;

    const bounds = L.latLngBounds(this.#workouts.map(work => work.coords));
    this.#map.fitBounds(bounds, { padding: [70, 70] });
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert(
          '⚠️ Inputs have to be positive numbers! Please check your values.',
        );

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('⚠️ Distance and duration have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        }),
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`,
      )
      .openPopup();

    // Store marker reference with workout ID
    this.#markers.push({ id: workout.id, marker });
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}
          <button class="workout__delete" title="Delete workout">✖</button>
          <button class="workout__edit" title="Edit workout">✎</button>
        </h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _handleWorkoutClick(e) {
    // Handle delete button
    if (e.target.classList.contains('workout__delete')) {
      const workoutEl = e.target.closest('.workout');
      if (!workoutEl) return;
      this._deleteWorkout(workoutEl.dataset.id);
      return;
    }

    // Handle edit button
    if (e.target.classList.contains('workout__edit')) {
      const workoutEl = e.target.closest('.workout');
      if (!workoutEl) return;
      this._editWorkout(workoutEl.dataset.id);
      return;
    }

    // Move to popup on workout click
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id,
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  _deleteWorkout(id) {
    if (!confirm('❓ Are you sure you want to delete this workout?')) return;

    // Remove workout from array
    const index = this.#workouts.findIndex(work => work.id === id);
    if (index > -1) {
      this.#workouts.splice(index, 1);
    }

    // Remove marker from map
    const markerObj = this.#markers.find(m => m.id === id);
    if (markerObj) {
      this.#map.removeLayer(markerObj.marker);
      this.#markers = this.#markers.filter(m => m.id !== id);
    }

    // Remove from UI
    const workoutEl = document.querySelector(`[data-id="${id}"]`);
    if (workoutEl) workoutEl.remove();

    // Update local storage
    this._setLocalStorage();

    alert('✅ Workout deleted successfully!');
  }

  _editWorkout(id) {
    const workout = this.#workouts.find(work => work.id === id);
    if (!workout) return;

    // Populate form with workout data
    form.classList.remove('hidden');
    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    if (workout.type === 'running') {
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.value = workout.cadence;
    }

    if (workout.type === 'cycling') {
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation.value = workout.elevationGain;
    }

    inputDistance.focus();

    // Set map event to workout's coordinates
    this.#mapEvent = {
      latlng: { lat: workout.coords[0], lng: workout.coords[1] },
    };

    // Delete old workout after form submission
    this._deleteWorkout(id);
  }

  _sortWorkouts(field) {
    this.#workouts.sort((a, b) => b[field] - a[field]);

    // Clear workout list
    document.querySelectorAll('.workout').forEach(el => el.remove());

    // Re-render workouts
    this.#workouts.forEach(work => this._renderWorkout(work));

    // Update local storage
    this._setLocalStorage();
  }

  _deleteAllWorkouts() {
    if (
      !confirm(
        '⚠️ Are you sure you want to delete ALL workouts? This cannot be undone!',
      )
    )
      return;

    // Clear markers from map
    this.#markers.forEach(markerObj => {
      this.#map.removeLayer(markerObj.marker);
    });
    this.#markers = [];

    // Clear workouts array
    this.#workouts = [];

    // Clear UI
    document.querySelectorAll('.workout').forEach(el => el.remove());

    // Clear local storage
    this._setLocalStorage();

    alert('✅ All workouts have been deleted!');
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    // Rebuild Running and Cycling objects from plain objects
    this.#workouts = data.map(work => {
      if (work.type === 'running') {
        const running = new Running(
          work.coords,
          work.distance,
          work.duration,
          work.cadence,
        );
        // Preserve original ID and date
        running.id = work.id;
        running.date = new Date(work.date);
        running.clicks = work.clicks;
        running._setDescription();
        return running;
      }

      if (work.type === 'cycling') {
        const cycling = new Cycling(
          work.coords,
          work.distance,
          work.duration,
          work.elevationGain,
        );
        // Preserve original ID and date
        cycling.id = work.id;
        cycling.date = new Date(work.date);
        cycling.clicks = work.clicks;
        cycling._setDescription();
        return cycling;
      }
    });

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
