/* eslint-disable @typescript-eslint/explicit-function-return-type */
import Joi from "joi"
import { validateOptionsSchema } from "../"

it(`validates a basic schema`, async () => {
  const pluginSchema = Joi.object({
    str: Joi.string(),
  })

  const validOptions = {
    str: `is a string`,
  }
  expect(await validateOptionsSchema(pluginSchema, validOptions)).toEqual(
    validOptions
  )

  const invalid = () =>
    validateOptionsSchema(pluginSchema, {
      str: 43,
    })

  expect(invalid()).rejects.toThrowErrorMatchingInlineSnapshot(
    `"\\"str\\" must be a string"`
  )
})

it(`asynchronously validates the external validation rules`, () => {
  const failingAsyncValidationRule = async () => {
    throw new Error(`This failed for some unknown reason.`)
  }

  const schema = Joi.object({}).external(failingAsyncValidationRule)

  const invalid = () => validateOptionsSchema(schema, {})

  expect(invalid()).rejects.toThrowErrorMatchingInlineSnapshot(
    `"This failed for some unknown reason. (value)"`
  )
})

it(`does not validate async external validation rules`, async () => {
  const failingAsyncValidationRule = async () => {
    throw new Error(`This failed for some unknown reason.`)
  }

  const schema = Joi.object({}).external(failingAsyncValidationRule)

  const invalid = () => validateOptionsSchema(schema, {}, false)

  expect(await invalid()).toMatchInlineSnapshot(`Object {}`)
})
