import { api, goToHome } from "./helpers/helpers.js";
//const flatpickr = require("flatpickr");

api.defaults.headers.common['token'] = localStorage.getItem('token')

const FIRST_HOUR = 9
const LAST_HOUR = 20
const clinicData = {};
const patientsDTOs = [];
const meetingsDatesDTOs = {};
let selectedPatientIndex = -1;
let newPatient;

const pad = (str, minLength, endStart = 'start', char = '0') => {
  if (str.length >= minLength)
    return str

  return endStart === 'start' ?
    char.repeat(minLength - str.length) + str :
    str + char.repeat(minLength - str.length)
}
//#region Begin the requests to get initial data
const assignClinicData = (async function () {
  console.log('getting clinic me')
  try {
    Object.assign(clinicData, (await api.get('/clinics/me')).data)
  } catch (err) {
    //TODO => go to a page where the error get shown and explained
    alert(err)
    goToHome()
  }
})()
const getPatientsDTOs = (async function () {
  try {
    //this endpoint have pagination, need more testing to see if pagination here is needed
    Object.assign(
      patientsDTOs,
      (await api.get('/patients/dtos')).data
        .sort((a, b) => a.name.localeCompare(b.name) || new Date(a.createdAt) - new Date(b.createdAt))
        .map(patient => {
          let date = new Date(patient.createdAt)
          let dateString = date.toLocaleString() ? date.toLocaleString() : date.toLocaleString('es-ES')
          patient.createdAt = dateString
          return patient
        })
    )
  } catch (err) {
    //TODO => go to a page where the error get shown and explained
    alert('error retrieving patients dtos: ', err)
    goToHome()
  }
})()
const getDecimalTime = date => {
  let timeStringSplit = date.toLocaleTimeString('es-ES').split(':')
  let integral = parseInt(timeStringSplit[0])
  let decimal = parseInt(timeStringSplit[1])
  decimal = decimal === 30 ? 0.5 : 0
  return integral + decimal
}
const getFormattedDateString = date => {
  console.log('getFormattedDateString', date)
  const getFormattedDatePart = part => {
    part = part.toString().trim()
    console.log('part: ', part)
    return part.length === 2 ? part : '0' + part
  }
  return `${pad(date.getDate().toString(), 2)}/${pad((date.getMonth() + 1).toString(), 2)}/${date.getFullYear()}`
}
const getMeetingsDateDTOs = (async function () {
  try {
    //this endpoint have pagination, need more testing to see if pagination here is needed
    Object.assign(meetingsDatesDTOs, (await api.get('/meetings/dtos/date')).data.reduce((acc, dto) => {
      let date = new Date(dto.date)
      let dateString = getFormattedDateString(date)
      Array.isArray(acc[dateString]) ?
        acc[dateString].push(getDecimalTime(date)) :
        acc[dateString] = [getDecimalTime(date)]
      return acc
    }, {}))
  } catch (err) {
    //TODO => go to a page where the error get shown and explained
    alert('error retrieving meetings dtos: ', err)
    goToHome()
  }
})()
console.log('async get request running')
//#endregion

//#region helpers
const fillClinicNameCard = name => {
  const clinicNameText = document.getElementById('clinicNameCardText')
  clinicNameText.innerText = name
  if (localStorage.getItem('name') !== name)
    localStorage.setItem('name', name)
}
const fillClinicFile = myClinicInputs => {
  console.log('fillClinicFile: ', clinicData)
  myClinicInputs.myClinicName.value = clinicData.name
  myClinicInputs.myClinicAddress.value = clinicData.address
  myClinicInputs.myClinicEmail.value = clinicData.email
  myClinicInputs.myClinicTelephone.value = clinicData.telephone
  myClinicInputs.myClinicContactPerson.value = clinicData.contactPerson || ''
}
const fillPatientsList = () => {
  let list = document.getElementById('patientsList')
  patientsDTOs.forEach(patient => {
    let option = document.createElement('option')
    option.innerHTML = `${patient.name} &nbsp;&nbsp;-&nbsp;&nbsp; ${patient.createdAt}`
    list.appendChild(option)
  })
}
const fillPatientsInputs = patientInputs => {
  console.log('fillPatientsInputs')
  for (let inputId in patientInputs) {
    if (inputId === 'patientsListInput')
      continue
    //All inputs id except patientsListInput, are '[nameOfDTOProperty]Input'
    patientInputs[inputId].value = patientsDTOs[selectedPatientIndex][inputId.slice(0, -5)]
  }
}
const getSelectedPatient = value => {
  /*
  - Hay que identificar al paciente no solo por el nombre => nombre y fecha de creación
  - Si elige un valor de la lista, el valor será de la forma 'name - date'

  Split al valor del input por '-'
  primer valor del split es el nombre
  segundo valor del split es la fecha de creación
  coje index de patientsDTOs con ese nombre y fecha
  */
  let split = value.split('-')
  let name = split[0].trim()
  let date = split[1] ? split[1].trim() : ''
  let selectedIdx = patientsDTOs.findIndex(patient => patient.name === name && patient.createdAt === date)
  console.log(`${name}\n${date}\n${selectedIdx}`)
  return { selectedIdx, name }
}
const updateField = (input, fieldName) => {
  console.log('updateField')
  api.put('/clinics/me', { [fieldName]: input.value })
    .then(response => {
      clinicData[fieldName] = input.value
      if (fieldName === 'name')
        fillClinicNameCard(input.value)
    })
    .catch(err => {
      alert(`No se pudo actualizar el campo: ${input.placeholder}`)
      input.value = clinicData[fieldName]
    })
}
const getBDFieldNameByInputId = inputId => {
  let fieldName
  switch (inputId) {
    case 'myClinicName':
      fieldName = 'name'
      break
    case 'myClinicAddress':
      fieldName = 'address'
      break
    case 'myClinicEmail':
      fieldName = 'email'
      break
    case 'myClinicTelephone':
      fieldName = 'telephone'
      break
    case 'myClinicContactPerson':
      fieldName = 'contactPerson'
      break
  }
  return fieldName
}
const fillMeetingsTimesList = selectedDate => {
  selectedDate = selectedDate.trim()
  console.log('list: ', selectedDate)
  console.log(meetingsDatesDTOs[selectedDate])
  let list = document.getElementById('meetingsTimesList')
  list.innerHTML = ''
  for (let i = FIRST_HOUR; i < LAST_HOUR; i += 0.5) {
    if (!meetingsDatesDTOs.hasOwnProperty(selectedDate) || !meetingsDatesDTOs[selectedDate].includes(i)) {
      let hours = pad(Math.floor(i).toString(), 2)
      let minutes = pad(((i - hours) * 60).toString(), 2)
      let text = `${hours}:${minutes}`
      let option = document.createElement('option')
      option.innerText = text
      list.appendChild(option)
    }
  }
}
//#endregion

//#region event callbacks
function signOut() {
  localStorage.clear()
  goToHome()
}
function updateFieldIfNecessary(e, clinicInputs) {
  //console.log(e)
  let fieldName = getBDFieldNameByInputId(e.target.id)
  let input = clinicInputs[e.target.id]
  let data = typeof clinicData[fieldName] === 'string' ? clinicData[fieldName] : clinicData[fieldName].toString()

  if (input.value !== data)
    updateField(input, fieldName)
}
function myClinicInputsOnKeyUp(e, clinicInputs) {
  if (e.key === 'Enter')
    updateFieldIfNecessary(e, clinicInputs)
}
function patientsListInputOnChange(e, newMeetingPatientInputs) {
  console.log(e, newMeetingPatientInputs)
  /*
  Coje el índice del paciente seleccionado por nombre y fecha
  Si el índice es el paciente ya seleccionado
    return

  Si el indice NO es -1 (ya existe ese paciente)
    llena los inputs con datos de ese paciente
  */
  let selected = getSelectedPatient(e.target.value)
  if (selected.selectedIdx === selectedPatientIndex)
    return

  if (selected.selectedIdx !== -1) {
    selectedPatientIndex = selected.selectedIdx
    fillPatientsInputs(newMeetingPatientInputs)
  }
}
function patientsListInputOnFocusOut(e, newMeetingPatientInputs) {
  /*
  Coje el índice del paciente seleccionado por nombre y fecha
  Si el índice es el paciente ya seleccionado
    return

  Si el indice es -1 (no existe ese paciente)
    Si ya hay un nuevo paciente con el mismo nombre
      return
    else Si ya hay un nuevo paciente con otro nombre
      cambia el nombre
    else
      nuevo paciente solo con nombre
  */
  let selected = getSelectedPatient(e.target.value)
  if (selected.selectedIdx === selectedPatientIndex)
    return

  if (selected.selectedIdx === -1) {
    if (newPatient) {
      if (newPatient.name === selected.name) {
        return
      } else {
        newPatient.name = selected.name
      }
    } else {
      newPatient = { name: selected.name }
    }
  }
}
function datepickerOnChange(selectedDates, dateStr, instance) {
  console.log('datepicker onchange')
  fillMeetingsTimesList(dateStr)
}
//#endregion

window.onload = async function () {
  const signOutButton = document.getElementById('signOutMobile')
  const myClinicInputs = {
    myClinicName: document.getElementById('myClinicName'),
    myClinicAddress: document.getElementById('myClinicAddress'),
    myClinicEmail: document.getElementById('myClinicEmail'),
    myClinicTelephone: document.getElementById('myClinicTelephone'),
    myClinicContactPerson: document.getElementById('myClinicContactPerson')
  }
  const newMeetingPatientInputs = {
    patientsListInput: document.getElementById('patientsListInput'),
    speciesInput: document.getElementById('speciesInput'),
    diseaseInput: document.getElementById('diseaseInput'),
    historyInput: document.getElementById('historyInput')
  }

  newMeetingPatientInputs.patientsListInput.addEventListener('change', e => { patientsListInputOnChange(e, newMeetingPatientInputs) })
  newMeetingPatientInputs.patientsListInput.addEventListener('focusout', patientsListInputOnFocusOut)

  //Adding on change event to flatpickr datepicker
  datePicker.config.onChange.push(datepickerOnChange)
  //**********************************************

  signOutButton.classList.remove('invisible')
  signOutButton.addEventListener('click', signOut)

  fillClinicNameCard(localStorage.getItem('name'))

  //NOW, don't do anything more until the data have arrived
  await assignClinicData
  //Now the data is here => keep going
  fillClinicFile(myClinicInputs)

  //This one I could put it BEFORE waiting for retrieving clinic data, but since it use the clinic data and there is a posibility that the user activates this event clicking something 
  //BEFORE the data has been actually recieved from the backend(bad connection, ridiculously impatient user, etc), I just prefer to wait for the data
  Object.values(myClinicInputs).forEach(input => {
    input.addEventListener('focusout', e => { updateFieldIfNecessary(e, myClinicInputs) })
    input.addEventListener('keyup', e => { myClinicInputsOnKeyUp(e, myClinicInputs) })
  })
  //*******************************

  await Promise.all([getPatientsDTOs, getMeetingsDateDTOs])
  fillPatientsList()
  console.log(meetingsDatesDTOs)
}